/**
 * IA-2 — Pure project workflow-state input for the next-action resolver.
 *
 * Already-resolved evidence only. The resolver does not fetch data.
 * Adapters (later consumers / IA-6) map repository state into this shape.
 *
 * Stronger non-current / running evidence MUST override legacy `*_done` flags
 * at the adapter boundary — done flags are not resolver inputs.
 */

/**
 * Authority currency for a workflow artefact.
 *
 * - `absent` — no durable artefact yet
 * - `current` — durable and current against upstream
 * - `non_current` — durable but Needs attention (stale / invalid upstream)
 * - `running` — required operation currently in progress
 */
export type WorkflowAuthorityCurrency = "absent" | "current" | "non_current" | "running";

/** Photos stage input. */
export type PhotosWorkflowState = {
  currency: WorkflowAuthorityCurrency;
  /** Optional count for diagnostics; not required for decisions. */
  photoCount?: number;
};

/** Analysis stage input. */
export type AnalysisWorkflowState = {
  currency: WorkflowAuthorityCurrency;
};

/**
 * Redesign stage input.
 *
 * Distinguishes generated-but-unselected candidates from selected authority.
 * Generated candidates alone never equal selected/current Redesign.
 */
export type RedesignWorkflowState = {
  currency: WorkflowAuthorityCurrency;
  /**
   * When currency is `absent`, true means candidates exist but none selected
   * (select_redesign). False/undefined means no concept yet (create_redesign).
   * Ignored when currency is current / non_current / running.
   */
  hasUnselectedCandidates?: boolean;
};

/**
 * Canonical Scope is an Estimate dependency — not a primary customer stage.
 * `absent` and `non_current` both block Estimate as Needs attention (reconcile_scope).
 */
export type ScopeWorkflowState = {
  currency: Exclude<WorkflowAuthorityCurrency, "running"> | "running";
};

/** Estimate stage input. */
export type EstimateWorkflowState = {
  currency: WorkflowAuthorityCurrency;
};

/** Export (report) stage input. */
export type ExportWorkflowState = {
  currency: WorkflowAuthorityCurrency;
};

/**
 * Full resolver workflow state for one project.
 * Pure data — no React, Supabase, AI, or mutation callbacks.
 */
export type ProjectWorkflowState = {
  photos: PhotosWorkflowState;
  analysis: AnalysisWorkflowState;
  redesign: RedesignWorkflowState;
  scope: ScopeWorkflowState;
  estimate: EstimateWorkflowState;
  export: ExportWorkflowState;
};

/**
 * Entitlement input for gated stages.
 * Narrow capability flags only — no pricing/plan redesign.
 */
export type ProjectWorkflowEntitlements = {
  /**
   * When false, required Redesign returns unlock_redesign instead of create/select/update.
   * Defaults to true when omitted.
   */
  redesignAllowed?: boolean;
  /**
   * Optional stable entitlement identifier for consumers (not parsed for branching).
   * Example: a plan capability key already used by the app.
   */
  redesignRequirement?: string;
};

/** Stable reason codes explaining why the action won (testable, non-label). */
export const PROJECT_NEXT_ACTION_REASONS = [
  "photos_missing",
  "photos_in_progress",
  "analysis_missing",
  "analysis_non_current",
  "analysis_in_progress",
  "redesign_required",
  "redesign_selection_required",
  "redesign_non_current",
  "redesign_entitlement_required",
  "redesign_in_progress",
  "scope_non_current",
  "estimate_missing",
  "estimate_non_current",
  "estimate_in_progress",
  "export_missing",
  "export_non_current",
  "export_in_progress",
  "project_complete",
] as const;

export type ProjectNextActionReason = (typeof PROJECT_NEXT_ACTION_REASONS)[number];
