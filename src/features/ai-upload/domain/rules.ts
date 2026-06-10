/**
 * AI-upload slice — Domain rules.
 *
 * Pure judgements over domain types. Vision AI produces language and condition
 * signals; pricing/ROI math stays in @repo/services (not here).
 */
import type { RoomAnalysis } from "./types";

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
