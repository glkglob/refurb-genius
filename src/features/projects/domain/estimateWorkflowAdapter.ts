/**
 * IA-5 — Pure Estimate workflow-state adapter for the IA-2 resolver.
 *
 * Currentness:
 *   estimate current iff durable Estimate exists AND Scope is current AND
 *   estimate.inputScopeId == currentScopeId
 *
 * Legacy estimates without input_scope_id are non_current once Scope is current
 * (must update_estimate).
 *
 * Legacy projects.estimate_done is never an input.
 */

import type { EstimateWorkflowState, WorkflowAuthorityCurrency } from "./projectWorkflowState";

export type EstimateAuthorityEvidence = {
  id: string;
  /** Bound Scope revision (scope_analyses.id). Empty/null → unbound legacy. */
  inputScopeId: string | null;
  /**
   * When true, row is a draft and never authoritative for Complete.
   * Authority path uses pricing_authority category-engine / measured-boq.
   */
  isDraft?: boolean;
};

export type EstimateAdapterInput = {
  scopeCurrency: WorkflowAuthorityCurrency;
  /** Current Scope revision id when Scope is current. */
  currentScopeId: string;
  estimate: EstimateAuthorityEvidence | null;
  estimateOperationRunning?: boolean;
};

export function estimateCurrencyFromEvidence(input: EstimateAdapterInput): EstimateWorkflowState {
  if (input.estimateOperationRunning) {
    return { currency: "running" };
  }

  if (input.scopeCurrency !== "current") {
    // Scope not current: Estimate cannot be Ready/current.
    // If an estimate exists, it is non_current relative to a future Scope.
    if (input.estimate && !input.estimate.isDraft) {
      return { currency: "non_current" };
    }
    return { currency: "absent" };
  }

  if (!input.estimate || input.estimate.isDraft) {
    return { currency: "absent" };
  }

  if (
    input.estimate.inputScopeId &&
    input.currentScopeId.length > 0 &&
    input.estimate.inputScopeId === input.currentScopeId
  ) {
    return { currency: "current" };
  }

  // Exists but wrong or missing Scope binding.
  return { currency: "non_current" };
}

export function estimateShellFlagsFromCurrency(currency: WorkflowAuthorityCurrency): {
  estimateDone: boolean;
  estimateNeedsAttention: boolean;
} {
  switch (currency) {
    case "current":
      return { estimateDone: true, estimateNeedsAttention: false };
    case "non_current":
      return { estimateDone: true, estimateNeedsAttention: true };
    case "running":
    case "absent":
      return { estimateDone: false, estimateNeedsAttention: false };
  }
}
