/**
 * IA-5 — Pure Scope workflow-state adapter for the IA-2 resolver.
 *
 * Canonical Scope is the durable scope_analyses tree. Scope is NOT a
 * customer-facing stage; currency feeds Estimate-stage continuation
 * (reconcile_scope when absent/non_current).
 *
 * Currentness:
 *   scope current iff a durable Scope row exists AND
 *   redesign is current AND analysis is current AND
 *   scope.analysisIdentity == currentAnalysisIdentity AND
 *   scope.redesignIdentity == currentSelectedRedesignIdentity
 *
 * Legacy rows without identity stamps are non_current once Redesign is current
 * (must reconcile).
 */

import type { ScopeWorkflowState, WorkflowAuthorityCurrency } from "./projectWorkflowState";

/** Minimal durable Scope authority evidence. */
export type ScopeAuthorityEvidence = {
  /** scope_analyses.id — also the Scope revision identity. */
  id: string;
  analysisIdentity: string;
  /** Stable Redesign identity (typically selected concept id). */
  redesignIdentity: string;
};

export type ScopeAdapterInput = {
  analysisCurrency: WorkflowAuthorityCurrency;
  redesignCurrency: WorkflowAuthorityCurrency;
  currentAnalysisIdentity: string;
  currentSelectedRedesignIdentity: string;
  /** Latest durable Scope (if any). */
  scope: ScopeAuthorityEvidence | null;
  scopeOperationRunning?: boolean;
};

/**
 * Scope currency relative to current Analysis + selected Redesign.
 */
export function scopeCurrencyFromEvidence(input: ScopeAdapterInput): ScopeWorkflowState {
  if (input.scopeOperationRunning) {
    return { currency: "running" };
  }

  // Without current Analysis + Redesign, Scope cannot be Ready/current.
  if (input.analysisCurrency !== "current" || input.redesignCurrency !== "current") {
    if (input.scope) {
      // Preserve non_current signal once upstream is restored.
      return { currency: "non_current" };
    }
    return { currency: "absent" };
  }

  if (!input.scope) {
    return { currency: "absent" };
  }

  const analysisOk =
    input.scope.analysisIdentity.length > 0 &&
    input.currentAnalysisIdentity.length > 0 &&
    input.scope.analysisIdentity === input.currentAnalysisIdentity;

  const redesignOk =
    input.scope.redesignIdentity.length > 0 &&
    input.currentSelectedRedesignIdentity.length > 0 &&
    input.scope.redesignIdentity === input.currentSelectedRedesignIdentity;

  if (analysisOk && redesignOk) {
    return { currency: "current" };
  }

  // Exists but wrong upstream binding (or legacy unstamped).
  return { currency: "non_current" };
}

/** Shell flags for Estimate-family Scope dependency (not a sixth stage). */
export function scopeShellFlagsFromCurrency(currency: WorkflowAuthorityCurrency): {
  scopeCurrent: boolean;
  scopeNeedsAttention: boolean;
} {
  switch (currency) {
    case "current":
      return { scopeCurrent: true, scopeNeedsAttention: false };
    case "non_current":
      return { scopeCurrent: false, scopeNeedsAttention: true };
    case "running":
    case "absent":
      return { scopeCurrent: false, scopeNeedsAttention: false };
  }
}
