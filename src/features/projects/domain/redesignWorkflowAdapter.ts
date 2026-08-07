/**
 * IA-4 — Pure Redesign workflow-state adapter for the IA-2 resolver.
 *
 * Maps durable Redesign selection evidence + current Analysis catalogue
 * identity into RedesignWorkflowState. No React, Supabase, AI, or mutation.
 *
 * Currentness:
 *   redesign current iff selected durable concept exists AND its
 *   analysisIdentity equals the current Analysis catalogue identity AND
 *   Analysis is current.
 *
 * Generated candidates alone never equal selected/current Redesign.
 */

import type { RedesignWorkflowState, WorkflowAuthorityCurrency } from "./projectWorkflowState";

/** Minimal durable Redesign candidate evidence. */
export type RedesignCandidateEvidence = {
  id: string;
  /** Style key for display / stable label. */
  style: string;
  /** Catalogue identity the candidate was generated against. */
  analysisIdentity: string;
  isSelected: boolean;
};

export type RedesignAdapterInput = {
  /** Analysis must be current for Redesign to be Ready/current. */
  analysisCurrency: WorkflowAuthorityCurrency;
  /** Exact current Analysis catalogue identity (durable photo-id set). */
  currentAnalysisIdentity: string;
  candidates: RedesignCandidateEvidence[];
  redesignOperationRunning?: boolean;
};

/**
 * Redesign currency relative to current Analysis catalogue identity.
 */
export function redesignCurrencyFromEvidence(input: RedesignAdapterInput): RedesignWorkflowState {
  if (input.redesignOperationRunning) {
    return { currency: "running" };
  }

  // Without current Analysis, Redesign cannot be Ready/current.
  if (input.analysisCurrency !== "current") {
    // Preserve non_current signal if a selection exists against a prior Analysis
    // so UI can explain stale once Analysis is restored.
    const selected = input.candidates.find((c) => c.isSelected);
    if (selected && selected.analysisIdentity !== input.currentAnalysisIdentity) {
      return { currency: "non_current" };
    }
    return { currency: "absent" };
  }

  const selected = input.candidates.find((c) => c.isSelected);
  if (selected) {
    if (
      selected.analysisIdentity.length > 0 &&
      selected.analysisIdentity === input.currentAnalysisIdentity
    ) {
      return { currency: "current" };
    }
    // Selected against older Analysis catalogue.
    return { currency: "non_current" };
  }

  if (input.candidates.length > 0) {
    // Candidates present but none selected → absent + hasUnselectedCandidates.
    return { currency: "absent", hasUnselectedCandidates: true };
  }

  return { currency: "absent", hasUnselectedCandidates: false };
}

/**
 * IA-4 shell flags for Redesign stage presentation.
 *
 * current → Complete
 * non_current → Needs attention
 * running / absent → not Complete (Ready / In progress by route)
 */
export function redesignShellFlagsFromCurrency(currency: WorkflowAuthorityCurrency): {
  redesignDone: boolean;
  redesignNeedsAttention: boolean;
} {
  switch (currency) {
    case "current":
      return { redesignDone: true, redesignNeedsAttention: false };
    case "non_current":
      return { redesignDone: true, redesignNeedsAttention: true };
    case "running":
    case "absent":
      return { redesignDone: false, redesignNeedsAttention: false };
  }
}
