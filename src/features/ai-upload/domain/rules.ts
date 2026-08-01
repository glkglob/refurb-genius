/**
 * AI-upload slice — Domain rules.
 *
 * Pure judgements over domain types. Vision AI produces language and condition
 * signals; pricing/ROI math stays in @repo/services (not here).
 */
import type { RoomAnalysis, RoomType } from "./types";
export { isImageFile, imageContentType } from "@/lib/file-utils";

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

/** Analyses that are safe to re-run (fallback / low confidence / mock). */
export function isRetryableAnalysis(analysis: RoomAnalysis): boolean {
  return (
    analysis.source === "fallback" ||
    analysis.source === "mock" ||
    analysis.confidence_score < CONFIDENCE_REVIEW_THRESHOLD
  );
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
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(a);
  }

  return order.map((roomType) => {
    const group = map.get(roomType) ?? [];
    const avg =
      group.length === 0 ? 0 : group.reduce((s, a) => s + a.confidence_score, 0) / group.length;
    return {
      roomType,
      analyses: group,
      averageConfidence: avg,
      needsReviewCount: group.filter(needsHumanReview).length,
    };
  });
}

/**
 * Detect likely duplicate photos by name + size (cheap pre-filter).
 * Returns ids that are duplicates of an earlier photo in the list.
 */
export function findDuplicatePhotoIds(
  photos: Array<{ id: string; name: string; size?: number }>,
): string[] {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];

  for (const p of photos) {
    const key = `${p.name.toLowerCase()}::${p.size ?? 0}`;
    const prior = seen.get(key);
    if (prior) {
      duplicates.push(p.id);
    } else {
      seen.set(key, p.id);
    }
  }

  return duplicates;
}

/**
 * Merge AI analysis suggestions into user-editable fields without clobbering.
 * - Empty target → take suggestion
 * - Non-empty target → keep target; expose suggestion separately
 */
export function suggestWithoutOverwrite<T extends string | number | null | undefined>(
  current: T,
  suggestion: T,
): { value: T; suggestion: T | null; applied: boolean } {
  const isEmpty =
    current === null ||
    current === undefined ||
    (typeof current === "string" && current.trim() === "");

  if (isEmpty) {
    return { value: suggestion, suggestion: null, applied: true };
  }
  if (current === suggestion) {
    return { value: current, suggestion: null, applied: false };
  }
  return { value: current, suggestion, applied: false };
}
