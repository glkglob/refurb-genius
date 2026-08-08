/**
 * IA-6 — Customer-facing explanations for resolver reason codes.
 *
 * Presentation only. Never invent workflow authority from legacy flags.
 * Do not surface internal revision/identity tokens.
 */
import type { ProjectNextActionReason } from "./projectWorkflowState";

const REASON_EXPLANATIONS: Readonly<Record<ProjectNextActionReason, string>> = {
  photos_missing: "Add room photos to begin the project workflow.",
  photos_in_progress: "Photo upload is in progress.",
  analysis_missing: "Run AI analysis on your photos.",
  analysis_non_current: "Analysis requires updating because Photos changed.",
  analysis_in_progress: "Photo analysis is in progress.",
  redesign_required: "Create redesign concepts from your current analysis.",
  redesign_selection_required: "Select a redesign concept to continue.",
  redesign_non_current: "Redesign requires updating because Analysis changed.",
  redesign_entitlement_required: "Unlock Redesign to continue this stage.",
  redesign_in_progress: "Redesign generation is in progress.",
  scope_non_current: "Review Scope because current Analysis or selected Redesign changed.",
  estimate_missing: "Build an estimate from the current scope.",
  estimate_non_current: "Update Estimate because Scope changed.",
  estimate_in_progress: "Estimate is in progress.",
  export_missing: "Create an investor report export from the current estimate.",
  export_non_current: "Update Export because Estimate changed.",
  export_in_progress: "Export is in progress.",
  project_complete: "All five workflow stages are current.",
};

/**
 * User-facing explanation for a resolver reason.
 * Returns empty string for unknown reasons (forward-compatible).
 */
export function explainProjectNextActionReason(reason: ProjectNextActionReason | string): string {
  if (reason in REASON_EXPLANATIONS) {
    return REASON_EXPLANATIONS[reason as ProjectNextActionReason];
  }
  return "";
}

/** True when any stage status is Needs attention (canonical vocabulary). */
export function workflowHasNeedsAttention(statuses: ReadonlyArray<{ status: string }>): boolean {
  return statuses.some((s) => s.status === "Needs attention");
}

/** True when all five stages are Complete. */
export function workflowAllStagesComplete(statuses: ReadonlyArray<{ status: string }>): boolean {
  return statuses.length > 0 && statuses.every((s) => s.status === "Complete");
}
