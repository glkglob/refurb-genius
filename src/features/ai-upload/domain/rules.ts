/**
 * AI-upload slice — Domain rules.
 *
 * Pure judgements over domain types. Vision AI produces language and condition
 * signals; pricing/ROI math stays in @repo/services (not here).
 */
import type { AnalysisPhotoSource, RoomAnalysis, RoomType } from "./types";
import {
  PHOTO_ANALYSIS_CARDINALITY_MISMATCH,
  PHOTO_ANALYSIS_MOCK_FORBIDDEN,
  PHOTO_ANALYSIS_PROVENANCE_MISMATCH,
  PhotoAnalysisError,
  noSourcePhotosError,
} from "./errors";
export { isImageFile, imageContentType } from "@/lib/file-utils";
export {
  PHOTO_ANALYSIS_NO_SOURCE_PHOTOS,
  PHOTO_ANALYSIS_CARDINALITY_MISMATCH,
  PHOTO_ANALYSIS_PROVENANCE_MISMATCH,
  PHOTO_ANALYSIS_MOCK_FORBIDDEN,
  PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS,
  PhotoAnalysisError,
  noSourcePhotosError,
  staleAnalysisRequiresReanalysisError,
} from "./errors";

/** Confidence below this is treated as needing human review. */
export const CONFIDENCE_REVIEW_THRESHOLD = 0.55;

/** A single analysis succeeded when the model returned a non-zero confidence. */
export function isSuccessfulAnalysis(analysis: RoomAnalysis): boolean {
  return analysis.confidence_score > 0 && analysis.source !== "fallback";
}

/** True when at least one photo fell back (per-photo failure or missing API key in dev). */
export function hasFallbackResults(analyses: RoomAnalysis[]): boolean {
  return analyses.some((a) => a.source === "fallback");
}

/** An analysis set is actionable when it contains at least one room with content. */
export function isActionableAnalysisSet(analyses: RoomAnalysis[]): boolean {
  return analyses.length > 0 && analyses.some((a) => a.ai_summary.length > 0);
}

/** Average confidence across a batch (0 when empty). */
export function averageConfidence(analyses: RoomAnalysis[]): number {
  if (analyses.length === 0) return 0;
  const sum = analyses.reduce((acc, a) => acc + a.confidence_score, 0);
  return sum / analyses.length;
}

/** True when the analysis should be labelled for human review. */
export function needsHumanReview(analysis: RoomAnalysis): boolean {
  if (analysis.source === "fallback" || analysis.source === "mock") return true;
  if (analysis.confidence_score < CONFIDENCE_REVIEW_THRESHOLD) return true;
  if (!analysis.ai_summary?.trim()) return true;
  return false;
}

/**
 * Analyses that are safe to re-run.
 * Canonical: every result that needs human review is retryable (single source of truth).
 */
export function isRetryableAnalysis(analysis: RoomAnalysis): boolean {
  return needsHumanReview(analysis);
}

/** Count analyses that still need human review / retry. */
export function countNeedingReview(analyses: RoomAnalysis[]): number {
  return analyses.filter(needsHumanReview).length;
}

/**
 * Stable photo identity for merge after re-analysis.
 * Prefer photo_url — after DB load, analysis.id is the row UUID, not photo id.
 */
export function analysisPhotoKey(analysis: Pick<RoomAnalysis, "photo_url" | "photo_name">): string {
  return analysis.photo_url || analysis.photo_name;
}

/**
 * Merge re-analysed results into existing set by photo key.
 * Refreshed entries overwrite only their keys; good analyses are retained.
 */
export function mergeAnalysesRetainingGood(
  existing: RoomAnalysis[],
  refreshed: RoomAnalysis[],
): RoomAnalysis[] {
  const byKey = new Map(existing.map((a) => [analysisPhotoKey(a), a]));
  for (const r of refreshed) {
    byKey.set(analysisPhotoKey(r), r);
  }
  const seen = new Set<string>();
  const out: RoomAnalysis[] = [];
  for (const a of existing) {
    const k = analysisPhotoKey(a);
    out.push(byKey.get(k)!);
    seen.add(k);
  }
  for (const r of refreshed) {
    const k = analysisPhotoKey(r);
    if (!seen.has(k)) {
      out.push(r);
      seen.add(k);
    }
  }
  return out;
}

export type PhotoAiStatus = "pending" | "analysed" | "fallback" | "failed" | "needs_review";

/** Map a stored analysis row to a coarse per-photo AI status for UI. */
export function photoAiStatus(analysis: RoomAnalysis | undefined): PhotoAiStatus {
  if (!analysis) return "pending";
  if (analysis.source === "fallback") return "fallback";
  if (analysis.source === "mock") return "failed";
  if (needsHumanReview(analysis)) return "needs_review";
  if (isSuccessfulAnalysis(analysis)) return "analysed";
  return "failed";
}

export type RoomAnalysisGroup = {
  roomType: RoomType;
  analyses: RoomAnalysis[];
  averageConfidence: number;
  needsReviewCount: number;
};

/**
 * Group analyses by room type (stable order by first appearance).
 * Used before estimate generation so scope is room-scoped.
 */
export function groupAnalysesByRoom(analyses: RoomAnalysis[]): RoomAnalysisGroup[] {
  const order: RoomType[] = [];
  const map = new Map<RoomType, RoomAnalysis[]>();

  for (const a of analyses) {
    const key = a.room_type;
    if (!map.has(key)) {
      order.push(key);
      map.set(key, []);
    }
    map.get(key)!.push(a);
  }

  return order.map((roomType) => {
    const group = map.get(roomType)!;
    return {
      roomType,
      analyses: group,
      averageConfidence: averageConfidence(group),
      needsReviewCount: group.filter(needsHumanReview).length,
    };
  });
}

/** Detect likely duplicate photos by exact name+size (client-side heuristic). */
export function findDuplicatePhotoIds(
  photos: Array<{ id: string; name: string; size: number }>,
): string[] {
  const seen = new Map<string, string>();
  const dups: string[] = [];
  for (const p of photos) {
    const key = `${p.name}::${p.size}`;
    const first = seen.get(key);
    if (first) dups.push(p.id);
    else seen.set(key, p.id);
  }
  return dups;
}

/** True when any analysis row is a bundled mock result. */
export function hasMockAnalysis(analyses: RoomAnalysis[]): boolean {
  return analyses.some((a) => a.source === "mock");
}

/** True when the set is non-empty and every row is mock. */
export function isMockOnlyAnalysisSet(analyses: RoomAnalysis[]): boolean {
  return analyses.length > 0 && analyses.every((a) => a.source === "mock");
}

type CataloguePhotoIdentity = Pick<AnalysisPhotoSource, "id" | "url" | "name">;

function catalogueKeys(catalogue: CataloguePhotoIdentity[]): Set<string> {
  const keys = new Set<string>();
  for (const p of catalogue) {
    if (p.url) keys.add(p.url);
    if (p.name) keys.add(p.name);
    if (p.id) keys.add(p.id);
  }
  return keys;
}

function analysisMatchesCatalogue(
  analysis: RoomAnalysis,
  catalogue: CataloguePhotoIdentity[],
  keys: Set<string>,
): boolean {
  if (keys.has(analysis.photo_url) || keys.has(analysis.photo_name) || keys.has(analysis.id)) {
    return true;
  }
  return catalogue.some(
    (p) =>
      p.id === analysis.id ||
      (p.url.length > 0 && p.url === analysis.photo_url) ||
      (p.name.length > 0 && p.name === analysis.photo_name),
  );
}

/**
 * Persisted analysis is stale relative to the canonical project photo catalogue when:
 * - any result source is mock; OR
 * - analysis photo identities do not correspond to the catalogue; OR
 * - the catalogue contains real photos absent from the analysis set.
 *
 * Empty analysis is not "stale" — it is simply missing (caller decides to run or not).
 */
export function isStaleAnalysisRelativeToCatalogue(
  analyses: RoomAnalysis[],
  catalogue: CataloguePhotoIdentity[],
): boolean {
  if (analyses.length === 0) return false;
  if (hasMockAnalysis(analyses)) return true;
  if (catalogue.length === 0) {
    // Analyses exist but catalogue is empty — identities cannot be grounded.
    return true;
  }

  const keys = catalogueKeys(catalogue);
  for (const a of analyses) {
    if (!analysisMatchesCatalogue(a, catalogue, keys)) return true;
  }

  const analysisKeys = new Set(analyses.map((a) => analysisPhotoKey(a)));
  const analysisIds = new Set(analyses.map((a) => a.id));
  for (const p of catalogue) {
    const key = p.url || p.name;
    if (!analysisKeys.has(key) && !analysisIds.has(p.id)) {
      return true;
    }
  }

  return false;
}

/**
 * A production-valid analysis set is non-empty, free of mock rows, and aligned
 * with the current canonical photo catalogue.
 */
export function isProductionValidAnalysisSet(
  analyses: RoomAnalysis[],
  catalogue: CataloguePhotoIdentity[],
): boolean {
  if (analyses.length === 0 || catalogue.length === 0) return false;
  if (hasMockAnalysis(analyses)) return false;
  return !isStaleAnalysisRelativeToCatalogue(analyses, catalogue);
}

/**
 * Assert vision output is grounded in the supplied project photos.
 * Rejects empty inputs, cardinality drift, mock rows, and unlinked results.
 */
export function assertAnalysisProvenance(
  photos: AnalysisPhotoSource[],
  results: RoomAnalysis[],
): void {
  if (photos.length === 0) {
    throw noSourcePhotosError();
  }
  if (results.length !== photos.length) {
    throw new PhotoAnalysisError(
      PHOTO_ANALYSIS_CARDINALITY_MISMATCH,
      `Expected ${photos.length} analyses for ${photos.length} photos, received ${results.length}.`,
    );
  }
  if (hasMockAnalysis(results)) {
    throw new PhotoAnalysisError(
      PHOTO_ANALYSIS_MOCK_FORBIDDEN,
      "Mock analysis results cannot be used as production analysis.",
    );
  }

  const byId = new Map(photos.map((p) => [p.id, p]));
  for (const result of results) {
    const photo = byId.get(result.id);
    if (!photo) {
      throw new PhotoAnalysisError(
        PHOTO_ANALYSIS_PROVENANCE_MISMATCH,
        "Analysis result is not linked to a supplied project photo.",
      );
    }
    if (result.photo_url !== photo.url || result.photo_name !== photo.name) {
      throw new PhotoAnalysisError(
        PHOTO_ANALYSIS_PROVENANCE_MISMATCH,
        "Analysis result photo identity does not match the supplied project photo.",
      );
    }
  }
}

/**
 * Non-destructive AI pre-fill: never overwrite a non-empty user value.
 * Returns the value to keep plus optional suggestion when AI differs.
 */
export function suggestWithoutOverwrite(
  current: string,
  aiSuggestion: string,
): { value: string; suggestion: string | null; applied: boolean } {
  const trimmed = current.trim();
  if (!trimmed) {
    return { value: aiSuggestion, suggestion: null, applied: true };
  }
  if (trimmed === aiSuggestion.trim()) {
    return { value: current, suggestion: null, applied: false };
  }
  return { value: current, suggestion: aiSuggestion, applied: false };
}
