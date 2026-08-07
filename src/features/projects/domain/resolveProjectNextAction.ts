/**
 * IA-2 — Canonical project next-action resolver (IA-0 v1.0.1 LOCKED).
 *
 * Pure, deterministic, read-only. Same inputs → same output.
 *
 * Ownership: Projects domain. Single semantic authority for
 * "What should this project do next?"
 *
 * MUST NOT: query DB, mutate state, call AI, navigate, emit analytics,
 * reconcile Scope, build Estimate, generate Export, or set `*_done`.
 *
 * Presentation stage model remains in workflowStages.ts (IA-1).
 * This module owns continuation decision authority only.
 */

import type { ProjectWorkflowStageId, ProjectWorkflowStatusLabel } from "./workflowStages";
import {
  PROJECT_NEXT_ACTION_LABELS,
  PROJECT_STAGE_PROGRESS_LABELS,
  type ProjectNextActionKind,
} from "./nextActionKinds";
import type {
  ProjectNextActionReason,
  ProjectWorkflowEntitlements,
  ProjectWorkflowState,
} from "./projectWorkflowState";

/** Resolved continuation decision. */
export type ProjectNextAction = {
  stage: ProjectWorkflowStageId;
  status: ProjectWorkflowStatusLabel;
  actionKind: ProjectNextActionKind;
  /** Absolute app path for the project (deterministic string). */
  route: string;
  /** Presentation only — never parse for semantics. */
  label: string;
  /** Stable reason the action won. */
  reason: ProjectNextActionReason;
  /** Present when actionKind is unlock_redesign (or other gated cases). */
  entitlementRequirement?: string;
};

export type ResolveProjectNextActionInput = {
  projectId: string;
  workflow: ProjectWorkflowState;
  entitlements?: ProjectWorkflowEntitlements;
};

/**
 * Build a project-scoped workflow route without React/router.
 * Never returns `/projects/$id/redesign` (IA-4) or primary `/scope` continuation.
 */
export function buildProjectNextActionRoute(
  projectId: string,
  surface: "overview" | "upload" | "analysis" | "redesign_focus" | "estimate" | "report",
): string {
  const id = projectId;
  switch (surface) {
    case "overview":
      return `/projects/${id}`;
    case "upload":
      return `/projects/${id}/upload`;
    case "analysis":
      return `/projects/${id}/analysis`;
    case "redesign_focus":
      // IA-1/IA-4 transitional surface — not a first-class redesign route.
      return `/projects/${id}/analysis?focus=redesign`;
    case "estimate":
      return `/projects/${id}/estimate`;
    case "report":
      return `/projects/${id}/report`;
  }
}

type InternalDecision = {
  stage: ProjectWorkflowStageId;
  status: ProjectWorkflowStatusLabel;
  actionKind: ProjectNextActionKind;
  surface: Parameters<typeof buildProjectNextActionRoute>[1];
  reason: ProjectNextActionReason;
  labelOverride?: string;
  entitlementRequirement?: string;
};

function resultFrom(projectId: string, decision: InternalDecision): ProjectNextAction {
  const label =
    decision.labelOverride ??
    (decision.actionKind === "view_stage_progress"
      ? PROJECT_STAGE_PROGRESS_LABELS[decision.stage]
      : PROJECT_NEXT_ACTION_LABELS[decision.actionKind]);

  return {
    stage: decision.stage,
    status: decision.status,
    actionKind: decision.actionKind,
    route: buildProjectNextActionRoute(projectId, decision.surface),
    label,
    reason: decision.reason,
    ...(decision.entitlementRequirement !== undefined
      ? { entitlementRequirement: decision.entitlementRequirement }
      : {}),
  };
}

function redesignAllowed(entitlements?: ProjectWorkflowEntitlements): boolean {
  return entitlements?.redesignAllowed !== false;
}

/**
 * Apply entitlement gate to a Redesign decision (same stage, unlock vs action).
 */
function applyRedesignEntitlement(
  decision: InternalDecision,
  entitlements?: ProjectWorkflowEntitlements,
): InternalDecision {
  if (redesignAllowed(entitlements)) return decision;
  // Running Redesign is already in flight — keep navigational progress.
  if (decision.actionKind === "view_stage_progress") return decision;

  return {
    stage: "redesign",
    status: "Ready",
    actionKind: "unlock_redesign",
    surface: "redesign_focus",
    reason: "redesign_entitlement_required",
    entitlementRequirement: entitlements?.redesignRequirement ?? "redesign",
  };
}

/**
 * Classify Needs attention (priority 1) for a stage, or null if not.
 * Scope non-current is classified under Estimate stage (not a sixth stage).
 */
function needsAttentionDecision(
  workflow: ProjectWorkflowState,
  entitlements?: ProjectWorkflowEntitlements,
): InternalDecision | null {
  const { photos, analysis, redesign, scope, estimate, export: exp } = workflow;

  // Photos non-current (rare; stronger catalogue invalidation when available).
  if (photos.currency === "non_current") {
    return {
      stage: "photos",
      status: "Needs attention",
      actionKind: "add_photos",
      surface: "upload",
      reason: "photos_missing",
    };
  }

  // Analysis non-current (stale) wins over all downstream.
  if (analysis.currency === "non_current") {
    return {
      stage: "analysis",
      status: "Needs attention",
      actionKind: "update_analysis",
      surface: "analysis",
      reason: "analysis_non_current",
    };
  }

  // Redesign non-current — only if Analysis is current (else Analysis missing/ready wins later).
  if (analysis.currency === "current" && redesign.currency === "non_current") {
    return applyRedesignEntitlement(
      {
        stage: "redesign",
        status: "Needs attention",
        actionKind: "update_redesign",
        surface: "redesign_focus",
        reason: "redesign_non_current",
      },
      entitlements,
    );
  }

  // Scope non-current / absent → Estimate-stage dependency failure (reconcile_scope).
  // Only when Analysis + Redesign are current (earlier stages still win if incomplete).
  if (
    analysis.currency === "current" &&
    redesign.currency === "current" &&
    (scope.currency === "absent" || scope.currency === "non_current")
  ) {
    return {
      stage: "estimate",
      status: "Needs attention",
      actionKind: "reconcile_scope",
      surface: "estimate",
      reason: "scope_non_current",
      labelOverride: PROJECT_NEXT_ACTION_LABELS.reconcile_scope,
    };
  }

  // Estimate non-current — only when Scope is current.
  if (
    analysis.currency === "current" &&
    redesign.currency === "current" &&
    scope.currency === "current" &&
    estimate.currency === "non_current"
  ) {
    return {
      stage: "estimate",
      status: "Needs attention",
      actionKind: "update_estimate",
      surface: "estimate",
      reason: "estimate_non_current",
    };
  }

  // Export non-current — only when Estimate is current.
  if (
    analysis.currency === "current" &&
    redesign.currency === "current" &&
    scope.currency === "current" &&
    estimate.currency === "current" &&
    exp.currency === "non_current"
  ) {
    return {
      stage: "export",
      status: "Needs attention",
      actionKind: "update_export",
      surface: "report",
      reason: "export_non_current",
    };
  }

  return null;
}

/**
 * Classify In progress (priority 2) — earliest running stage in journey order.
 */
function inProgressDecision(workflow: ProjectWorkflowState): InternalDecision | null {
  const { photos, analysis, redesign, estimate, export: exp } = workflow;

  if (photos.currency === "running") {
    return {
      stage: "photos",
      status: "In progress",
      actionKind: "view_stage_progress",
      surface: "upload",
      reason: "photos_in_progress",
    };
  }

  if (analysis.currency === "running") {
    return {
      stage: "analysis",
      status: "In progress",
      actionKind: "view_stage_progress",
      surface: "analysis",
      reason: "analysis_in_progress",
    };
  }

  if (redesign.currency === "running") {
    return {
      stage: "redesign",
      status: "In progress",
      actionKind: "view_stage_progress",
      surface: "redesign_focus",
      reason: "redesign_in_progress",
    };
  }

  // Scope running treated as Estimate-family progress at estimate route.
  if (workflow.scope.currency === "running") {
    return {
      stage: "estimate",
      status: "In progress",
      actionKind: "view_stage_progress",
      surface: "estimate",
      reason: "estimate_in_progress",
    };
  }

  if (estimate.currency === "running") {
    return {
      stage: "estimate",
      status: "In progress",
      actionKind: "view_stage_progress",
      surface: "estimate",
      reason: "estimate_in_progress",
    };
  }

  if (exp.currency === "running") {
    return {
      stage: "export",
      status: "In progress",
      actionKind: "view_stage_progress",
      surface: "report",
      reason: "export_in_progress",
    };
  }

  return null;
}

/**
 * Classify earliest incomplete Ready stage (priority 3).
 */
function readyDecision(
  workflow: ProjectWorkflowState,
  entitlements?: ProjectWorkflowEntitlements,
): InternalDecision | null {
  const { photos, analysis, redesign, scope, estimate, export: exp } = workflow;

  if (photos.currency === "absent") {
    return {
      stage: "photos",
      status: "Ready",
      actionKind: "add_photos",
      surface: "upload",
      reason: "photos_missing",
    };
  }

  if (photos.currency === "current" && analysis.currency === "absent") {
    return {
      stage: "analysis",
      status: "Ready",
      actionKind: "analyse_photos",
      surface: "analysis",
      reason: "analysis_missing",
    };
  }

  if (analysis.currency === "current" && redesign.currency === "absent") {
    const base: InternalDecision = redesign.hasUnselectedCandidates
      ? {
          stage: "redesign",
          status: "Ready",
          actionKind: "select_redesign",
          surface: "redesign_focus",
          reason: "redesign_selection_required",
        }
      : {
          stage: "redesign",
          status: "Ready",
          actionKind: "create_redesign",
          surface: "redesign_focus",
          reason: "redesign_required",
        };
    return applyRedesignEntitlement(base, entitlements);
  }

  // Redesign current → Scope handled in needsAttention; Estimate Ready when Scope current.
  if (
    analysis.currency === "current" &&
    redesign.currency === "current" &&
    scope.currency === "current" &&
    estimate.currency === "absent"
  ) {
    return {
      stage: "estimate",
      status: "Ready",
      actionKind: "build_estimate",
      surface: "estimate",
      reason: "estimate_missing",
    };
  }

  if (
    analysis.currency === "current" &&
    redesign.currency === "current" &&
    scope.currency === "current" &&
    estimate.currency === "current" &&
    exp.currency === "absent"
  ) {
    return {
      stage: "export",
      status: "Ready",
      actionKind: "create_export",
      surface: "report",
      reason: "export_missing",
    };
  }

  return null;
}

function allRequiredCurrent(workflow: ProjectWorkflowState): boolean {
  return (
    workflow.photos.currency === "current" &&
    workflow.analysis.currency === "current" &&
    workflow.redesign.currency === "current" &&
    workflow.scope.currency === "current" &&
    workflow.estimate.currency === "current" &&
    workflow.export.currency === "current"
  );
}

/**
 * Canonical next-action resolver.
 *
 * Precedence (IA-0 v1.0.1):
 * 1. Earliest Needs attention / non-current
 * 2. Earliest In progress
 * 3. Earliest incomplete Ready (+ entitlement on that stage)
 * 4. view_completed_project when all required authorities are current
 */
export function resolveProjectNextAction(input: ResolveProjectNextActionInput): ProjectNextAction {
  const { projectId, workflow, entitlements } = input;

  const attention = needsAttentionDecision(workflow, entitlements);
  if (attention) return resultFrom(projectId, attention);

  const progress = inProgressDecision(workflow);
  if (progress) return resultFrom(projectId, progress);

  const ready = readyDecision(workflow, entitlements);
  if (ready) return resultFrom(projectId, ready);

  if (allRequiredCurrent(workflow)) {
    return resultFrom(projectId, {
      stage: "export",
      status: "Complete",
      actionKind: "view_completed_project",
      surface: "overview",
      reason: "project_complete",
    });
  }

  // Conservative fallback: incomplete without clear classification → Photos Ready.
  // Should be unreachable when adapters supply consistent currency graphs.
  return resultFrom(projectId, {
    stage: "photos",
    status: "Ready",
    actionKind: "add_photos",
    surface: "upload",
    reason: "photos_missing",
  });
}
