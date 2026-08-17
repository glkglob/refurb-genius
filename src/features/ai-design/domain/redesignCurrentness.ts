/**
 * Read-time Redesign currentness.
 *
 * A concept is current iff Analysis is production-current AND
 * concept.analysisIdentity equals the canonical identity of that current
 * Analysis catalogue. Historical rows stay persisted; stale is_selected
 * does not make Redesign current.
 *
 * Identity algorithm is analysisIdentityFromPhotoIds — do not invent another.
 */
import { analysisIdentityFromPhotoIds } from "./redesignAuthority";

export type RedesignCurrentnessInput = {
  analysisIsCurrent: boolean;
  currentAnalysisIdentity: string;
};

export type RedesignConceptCurrentnessEvidence = {
  id: string;
  analysisIdentity: string;
  isSelected?: boolean;
};

/**
 * Canonical current Analysis identity, or "" when Analysis is not current.
 * Never fingerprints a non-current leftover photo_id set.
 */
export function resolveCurrentAnalysisIdentity(input: {
  analysisIsCurrent: boolean;
  photoIds: Array<string | null | undefined>;
}): string {
  if (!input.analysisIsCurrent) return "";
  return analysisIdentityFromPhotoIds(input.photoIds);
}

export function isCurrentRedesignConcept(
  concept: RedesignConceptCurrentnessEvidence,
  input: RedesignCurrentnessInput,
): boolean {
  if (!input.analysisIsCurrent) return false;
  if (!input.currentAnalysisIdentity) return false;
  return concept.analysisIdentity === input.currentAnalysisIdentity;
}

export function selectCurrentRedesignConcepts<T extends RedesignConceptCurrentnessEvidence>(
  concepts: readonly T[],
  input: RedesignCurrentnessInput,
): T[] {
  if (!input.analysisIsCurrent || !input.currentAnalysisIdentity) return [];
  return concepts.filter((concept) => concept.analysisIdentity === input.currentAnalysisIdentity);
}

export function currentSelectedRedesignConcept<T extends RedesignConceptCurrentnessEvidence>(
  concepts: readonly T[],
  input: RedesignCurrentnessInput,
): T | null {
  return (
    selectCurrentRedesignConcepts(concepts, input).find((concept) => concept.isSelected) ?? null
  );
}

export function currentSelectedRedesignId(
  concepts: readonly RedesignConceptCurrentnessEvidence[],
  input: RedesignCurrentnessInput,
): string | null {
  return currentSelectedRedesignConcept(concepts, input)?.id ?? null;
}
