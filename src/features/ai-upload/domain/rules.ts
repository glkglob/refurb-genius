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
  PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED,
  PHOTO_ANALYSIS_SOURCE_NOT_AUTHORISED,
  PHOTO_ANALYSIS_SOURCE_SET_MISMATCH,
  PHOTO_ANALYSIS_PERSISTENCE_FAILED,
  PhotoAnalysisError,
  noSourcePhotosError,
  staleAnalysisRequiresReanalysisError,
  projectNotAuthorisedError,
  sourceNotAuthorisedError,
  sourceSetMismatchError,
  persistenceFailedError,
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
 * Stable source-photo identity for merge / catalogue matching.
 * Prefer durable photo_id; fall back to URL/name only for legacy rows.
 */
export function analysisPhotoKey(
  analysis: Pick<RoomAnalysis, "photo_id" | "photo_url" | "photo_name">,
): string {
  if (analysis.photo_id) return analysis.photo_id;
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

/**
 * Durable current photo-catalogue identity (IA-0 / IA-3).
 *
 * Deterministic properties:
 * - same durable photo id set → same identity (order-independent);
 * - add / remove / replace of durable photo ids changes identity;
 * - signed URL / display-name changes MUST NOT change identity.
 *
 * Implementation: sorted durable photo UUIDs joined by unit separator.
 */
export function durablePhotoCatalogueIdentity(
  catalogue: Array<Pick<AnalysisPhotoSource, "id">>,
): string {
  return [...catalogue]
    .map((p) => p.id)
    .filter((id) => typeof id === "string" && id.length > 0)
    .sort()
    .join("\u0001");
}

/**
 * Stable catalogue identity fingerprint for route/cache invalidation.
 * Alias of durablePhotoCatalogueIdentity (IA-3: durable ids only).
 */
export function catalogueIdentityFingerprint(
  catalogue: Array<Pick<AnalysisPhotoSource, "id" | "url">>,
): string {
  return durablePhotoCatalogueIdentity(catalogue);
}

/**
 * Shared production authority guard (IA-3 currentness).
 *
 * analysisCurrent =
 *   non-empty authoritative analyses
 *   AND no mock rows
 *   AND every row has durable photo_id
 *   AND photo_id set exactly equals current catalogue id set
 *
 * Signed URL / name drift alone MUST NOT invalidate currentness.
 * Existence and legacy analysis_done are not sufficient.
 */
export function isProductionValidAnalysisSet(
  analyses: RoomAnalysis[],
  catalogue: CataloguePhotoIdentity[],
): boolean {
  if (analyses.length === 0 || catalogue.length === 0) return false;
  if (hasMockAnalysis(analyses)) return false;
  if (analyses.some((a) => !a.photo_id || a.source === "mock")) return false;
  // Only durable AI/fallback sources may be current production authority.
  if (analyses.some((a) => a.source !== "ai" && a.source !== "fallback")) return false;

  const catIds = new Set(catalogue.map((p) => p.id));
  if (catIds.size !== catalogue.length) return false;

  const analysisIds = new Set(analyses.map((a) => a.photo_id as string));
  if (analysisIds.size !== analyses.length) return false;
  if (analysisIds.size !== catIds.size) return false;

  for (const id of catIds) {
    if (!analysisIds.has(id)) return false;
  }
  return true;
}

/**
 * Persisted analysis is stale relative to the canonical project photo catalogue when
 * it is non-empty and fails the production validity guard (mock, missing photo_id,
 * incomplete/mismatched coverage, or catalogue drift).
 */
export function isStaleAnalysisRelativeToCatalogue(
  analyses: RoomAnalysis[],
  catalogue: CataloguePhotoIdentity[],
): boolean {
  if (analyses.length === 0) return false;
  return !isProductionValidAnalysisSet(analyses, catalogue);
}

/**
 * Choose Analysis evidence for a current photo catalogue.
 * Prefer in-memory cache only when it is production-valid against the catalogue.
 * Otherwise use durable persisted rows. Does not change currentness rules.
 */
export function preferAnalysesForCurrentCatalogue(input: {
  cached?: RoomAnalysis[] | null;
  persisted?: RoomAnalysis[] | null;
  catalogue: Array<Pick<AnalysisPhotoSource, "id">>;
}): RoomAnalysis[] {
  const cached = input.cached ?? [];
  const persisted = input.persisted ?? [];
  const catalogue: CataloguePhotoIdentity[] = input.catalogue.map((photo) => ({
    id: photo.id,
    url: "",
    name: "",
  }));
  if (cached.length > 0 && isProductionValidAnalysisSet(cached, catalogue)) {
    return cached;
  }
  if (persisted.length > 0) return persisted;
  return cached;
}

/**
 * Assert vision output is grounded in the supplied project photos using photo_id.
 * Rejects empty inputs, cardinality drift, mock rows, duplicates, and unlinked results.
 */
export function assertAnalysisProvenance(
  photos: AnalysisPhotoSource[],
  results: RoomAnalysis[],
): void {
  if (photos.length === 0) {
    throw noSourcePhotosError();
  }

  const inputIds = photos.map((p) => p.id);
  if (new Set(inputIds).size !== inputIds.length) {
    throw new PhotoAnalysisError(
      PHOTO_ANALYSIS_PROVENANCE_MISMATCH,
      "Duplicate project photo IDs are not allowed.",
    );
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

  const resultIds = results.map((r) => r.photo_id);
  if (resultIds.some((id) => !id)) {
    throw new PhotoAnalysisError(
      PHOTO_ANALYSIS_PROVENANCE_MISMATCH,
      "Analysis result is missing durable photo_id.",
    );
  }
  if (new Set(resultIds).size !== resultIds.length) {
    throw new PhotoAnalysisError(
      PHOTO_ANALYSIS_PROVENANCE_MISMATCH,
      "Duplicate analysis photo_id values are not allowed.",
    );
  }

  const inputSet = new Set(inputIds);
  const resultSet = new Set(resultIds as string[]);
  if (inputSet.size !== resultSet.size) {
    throw new PhotoAnalysisError(
      PHOTO_ANALYSIS_PROVENANCE_MISMATCH,
      "Analysis photo_id set does not match input project photos.",
    );
  }
  for (const id of inputSet) {
    if (!resultSet.has(id)) {
      throw new PhotoAnalysisError(
        PHOTO_ANALYSIS_PROVENANCE_MISMATCH,
        "Analysis photo_id set does not match input project photos.",
      );
    }
  }

  const byId = new Map(photos.map((p) => [p.id, p]));
  for (const result of results) {
    const photo = byId.get(result.photo_id as string);
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
