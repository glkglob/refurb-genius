/**
 * IA-3 — Pure Photos → Analysis workflow-state adapters for the IA-2 resolver.
 *
 * Maps already-resolved durable photo catalogue + Analysis evidence into
 * ProjectWorkflowState currency. No React, Supabase, AI, or mutation.
 *
 * Currentness rule (aligned with ai-upload production validity):
 *   analysis current iff non-mock authoritative rows cover exactly the
 *   current durable photo id set.
 *
 * Legacy `*_done` flags are intentionally not inputs.
 */

import type {
  AnalysisWorkflowState,
  PhotosWorkflowState,
  ProjectWorkflowState,
  WorkflowAuthorityCurrency,
} from "./projectWorkflowState";

/** Minimal durable photo identity for catalogue currentness. */
export type DurablePhotoIdentity = {
  id: string;
};

/** Minimal Analysis row evidence for Photos→Analysis currentness. */
export type AnalysisAuthorityEvidence = {
  photoId?: string | null;
  /** ai | fallback | mock | persisted | … */
  source?: string | null;
};

export type PhotosAnalysisAdapterInput = {
  photos: DurablePhotoIdentity[];
  /** Authoritative in-flight photo mutation (upload/remove) when known. */
  photosOperationRunning?: boolean;
  analyses: AnalysisAuthorityEvidence[];
  /** Authoritative in-flight Analysis when known. */
  analysisOperationRunning?: boolean;
};

/**
 * Photos currency from durable catalogue + optional running mutation.
 * Complete/current requires at least one durable photo (IA-0).
 */
export function photosCurrencyFromEvidence(input: {
  photos: DurablePhotoIdentity[];
  photosOperationRunning?: boolean;
}): PhotosWorkflowState {
  if (input.photosOperationRunning) {
    return { currency: "running", photoCount: input.photos.length };
  }
  if (input.photos.length > 0) {
    return { currency: "current", photoCount: input.photos.length };
  }
  return { currency: "absent", photoCount: 0 };
}

function isAuthoritativeSource(source: string | null | undefined): boolean {
  return source === "ai" || source === "fallback";
}

/**
 * Analysis currency relative to the current durable photo catalogue.
 *
 * - mock / incomplete / mismatched photo_id sets → non_current when rows exist
 * - empty analyses + current photos → absent
 * - exact photo_id coverage + authoritative sources → current
 */
export function analysisCurrencyFromEvidence(input: {
  photos: DurablePhotoIdentity[];
  analyses: AnalysisAuthorityEvidence[];
  analysisOperationRunning?: boolean;
}): AnalysisWorkflowState {
  if (input.analysisOperationRunning) {
    return { currency: "running" };
  }

  const photoIds = input.photos.map((p) => p.id).filter(Boolean);
  if (photoIds.length === 0) {
    // No durable photos: Analysis cannot be Ready/current.
    return { currency: "absent" };
  }

  if (input.analyses.length === 0) {
    return { currency: "absent" };
  }

  const catSet = new Set(photoIds);
  if (catSet.size !== photoIds.length) {
    // Duplicate catalogue ids — treat as non-authoritative.
    return { currency: "non_current" };
  }

  const hasMock = input.analyses.some((a) => a.source === "mock");
  const allAuthoritative = input.analyses.every((a) => isAuthoritativeSource(a.source));
  const analysisIds = input.analyses
    .map((a) => a.photoId)
    .filter((id): id is string => Boolean(id));
  const analysisSet = new Set(analysisIds);

  const completeCoverage =
    !hasMock &&
    allAuthoritative &&
    analysisIds.length === input.analyses.length &&
    analysisSet.size === analysisIds.length &&
    analysisSet.size === catSet.size &&
    [...catSet].every((id) => analysisSet.has(id));

  if (completeCoverage) {
    return { currency: "current" };
  }

  // Rows exist but are mock, incomplete, or mismatched → Needs attention.
  return { currency: "non_current" };
}

/**
 * Build a full ProjectWorkflowState focused on Photos→Analysis continuity.
 *
 * Downstream stages default to absent so the IA-2 resolver advances to Redesign
 * after current Analysis without inventing Redesign/Scope/Estimate authority (IA-4+).
 */
export function buildPhotosAnalysisWorkflowState(
  input: PhotosAnalysisAdapterInput,
): ProjectWorkflowState {
  const photos = photosCurrencyFromEvidence({
    photos: input.photos,
    photosOperationRunning: input.photosOperationRunning,
  });
  const analysis = analysisCurrencyFromEvidence({
    photos: input.photos,
    analyses: input.analyses,
    analysisOperationRunning: input.analysisOperationRunning,
  });

  return {
    photos,
    analysis,
    redesign: { currency: "absent" },
    scope: { currency: "absent" },
    estimate: { currency: "absent" },
    export: { currency: "absent" },
  };
}

/**
 * IA-3-R1 — Map Analysis currency to IA-1 shell progress flags.
 *
 * Canonical contract:
 * - current (incl. authoritative fallback / low-confidence review recommended)
 *   → analysisDone + NOT Needs attention (shell Complete; resolver may advance)
 * - non_current (stale catalogue, mock, incomplete coverage)
 *   → analysisDone + Needs attention (shell recovery; update_analysis)
 * - running / absent → not done, not attention (Ready / In progress by route)
 *
 * Low-confidence and fallback quality signals are advisory only. They MUST NOT
 * set analysisNeedsAttention when currency is current.
 */
export function analysisShellFlagsFromCurrency(currency: WorkflowAuthorityCurrency): {
  analysisDone: boolean;
  analysisNeedsAttention: boolean;
} {
  switch (currency) {
    case "current":
      return { analysisDone: true, analysisNeedsAttention: false };
    case "non_current":
      return { analysisDone: true, analysisNeedsAttention: true };
    case "running":
    case "absent":
      return { analysisDone: false, analysisNeedsAttention: false };
  }
}

/** Test helper: map currency labels without importing presentation types. */
export function isRunningCurrency(currency: WorkflowAuthorityCurrency): boolean {
  return currency === "running";
}
