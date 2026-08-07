/**
 * IA-2 — Stable semantic action kinds for the project next-action resolver.
 *
 * Authoritative for continuation semantics (IA-0 v1.0.1 LOCKED).
 * Labels are presentation only — consumers MUST NOT parse labels.
 */

/** Locked IA-0 v1.0.1 semantic action kinds. Do not invent additional kinds. */
export const PROJECT_NEXT_ACTION_KINDS = [
  "add_photos",
  "analyse_photos",
  "update_analysis",
  "create_redesign",
  "select_redesign",
  "update_redesign",
  "unlock_redesign",
  "reconcile_scope",
  "build_estimate",
  "update_estimate",
  "create_export",
  "update_export",
  "view_stage_progress",
  "view_completed_project",
] as const;

export type ProjectNextActionKind = (typeof PROJECT_NEXT_ACTION_KINDS)[number];

export function isProjectNextActionKind(value: string): value is ProjectNextActionKind {
  return (PROJECT_NEXT_ACTION_KINDS as readonly string[]).includes(value);
}

/**
 * Default customer-facing labels for each actionKind.
 * Presentation copy only — never used for branching.
 */
export const PROJECT_NEXT_ACTION_LABELS: Readonly<Record<ProjectNextActionKind, string>> = {
  add_photos: "Add Photos",
  analyse_photos: "Analyse Photos",
  update_analysis: "Update Analysis",
  create_redesign: "Create Redesign",
  select_redesign: "Select Redesign",
  update_redesign: "Update Redesign",
  unlock_redesign: "Unlock Redesign",
  reconcile_scope: "Review Scope",
  build_estimate: "Build Estimate",
  update_estimate: "Update Estimate",
  create_export: "Create Report",
  update_export: "Update Report",
  view_stage_progress: "View Progress",
  view_completed_project: "View Project",
};

/** Progress labels for view_stage_progress (stage-specific presentation). */
export const PROJECT_STAGE_PROGRESS_LABELS = {
  photos: "View Upload Progress",
  analysis: "View Analysis Progress",
  redesign: "View Redesign Progress",
  estimate: "View Estimate Progress",
  export: "View Report Progress",
} as const;
