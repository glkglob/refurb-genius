/**
 * IA-4 — Pure Redesign workflow-state adapter for the IA-2 resolver.
 *
 * Maps durable Redesign selection evidence + current Analysis catalogue
 * identity into RedesignWorkflowState. No React, Supabase, AI, or mutation.
 *
 * Currentness:
 *   redesign current iff a current-selected concept exists (Analysis current
 *   AND analysisIdentity equals the current Analysis identity).
 *   Historical/stale is_selected is ignored. Generated candidates alone
 *   never equal selected/current Redesign.
 */

import {
  currentSelectedRedesignConcept,
  selectCurrentRedesignConcepts,
} from "@/features/ai-design/domain";
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

  const analysisIsCurrent = input.analysisCurrency === "current";
  const currentness = {
    analysisIsCurrent,
    currentAnalysisIdentity: analysisIsCurrent ? input.currentAnalysisIdentity : "",
  };
  const currentCandidates = selectCurrentRedesignConcepts(input.candidates, currentness);
  const selected = currentSelectedRedesignConcept(currentCandidates, currentness);

  if (!analysisIsCurrent) {
    return { currency: "absent" };
  }
  if (selected) {
    return { currency: "current" };
  }
  if (currentCandidates.length > 0) {
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
      return { redesignDone: false, redesignNeedsAttention: true };
    case "running":
    case "absent":
      return { redesignDone: false, redesignNeedsAttention: false };
  }
}
