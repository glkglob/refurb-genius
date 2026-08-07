/**
 * IA-1 — Canonical five-stage project workflow presentation model.
 *
 * Presentation-only status/nav model (IA-1).
 *
 * Authoritative next-action decisions: resolveProjectNextAction (IA-2).
 * Does not own provenance (later), Redesign route authority (IA-4), or Scope
 * business logic (IA-9).
 *
 * Controlling journey (IA-0 LOCKED v1.0.1):
 *   Photos → Analysis → Redesign → Estimate → Export
 *
 * Project Overview is the project home — not a workflow stage.
 */

/** Stable stage identifiers for the locked five-stage journey. */
export const PROJECT_WORKFLOW_STAGE_IDS = [
  "photos",
  "analysis",
  "redesign",
  "estimate",
  "export",
] as const;

export type ProjectWorkflowStageId = (typeof PROJECT_WORKFLOW_STAGE_IDS)[number];

/** User-facing status vocabulary (IA-0 / IA-1). No internal provenance terms. */
export const PROJECT_WORKFLOW_STATUS_LABELS = [
  "Not started",
  "Ready",
  "In progress",
  "Needs attention",
  "Complete",
] as const;

export type ProjectWorkflowStatusLabel = (typeof PROJECT_WORKFLOW_STATUS_LABELS)[number];

export type ProjectWorkflowStageDefinition = {
  id: ProjectWorkflowStageId;
  /** 1-based display order in the journey. */
  order: number;
  label: string;
  /** Short helper text for navigation chrome. */
  description: string;
  /**
   * When true, the stage has a first-class implemented route destination.
   * Redesign is transitional until IA-4 (`/projects/$id/redesign`).
   */
  hasImplementedRoute: boolean;
};

/**
 * Single shared presentation representation of the locked journey.
 * Consumers MUST derive stage lists from this constant — do not duplicate
 * independent stage arrays in route files.
 */
export const PROJECT_WORKFLOW_STAGES: readonly ProjectWorkflowStageDefinition[] = [
  {
    id: "photos",
    order: 1,
    label: "Photos",
    description: "Upload room photos",
    hasImplementedRoute: true,
  },
  {
    id: "analysis",
    order: 2,
    label: "Analysis",
    description: "AI condition review",
    hasImplementedRoute: true,
  },
  {
    id: "redesign",
    order: 3,
    label: "Redesign",
    description: "Style concepts",
    // IA-4 owns `/projects/$id/redesign`. Until then, navigation targets the
    // existing embedded Redesign surface on Analysis (no dead route).
    hasImplementedRoute: false,
  },
  {
    id: "estimate",
    order: 4,
    label: "Estimate",
    description: "Refurb costs",
    hasImplementedRoute: true,
  },
  {
    id: "export",
    order: 5,
    label: "Export",
    description: "Investor report",
    hasImplementedRoute: true,
  },
] as const;

/** Overview is project home / status — never a workflow stage. */
export const PROJECT_OVERVIEW_IS_WORKFLOW_STAGE = false;

/**
 * Progress flags available today (compatibility projection).
 * IA-1 does not invent redesign_done or provenance; redesign status is
 * conservative until later phases supply authority.
 */
export type ProjectWorkflowProgressInput = {
  photosDone: boolean;
  analysisDone: boolean;
  estimateDone: boolean;
  reportDone: boolean;
  /** Optional photo count for richer Photos status. */
  photoCount?: number;
  /**
   * When Analysis is durable but non-current (stale catalogue, mock, incomplete
   * coverage) and requires recovery. Maps to user-facing "Needs attention".
   *
   * IA-3-R1: MUST NOT be set for low-confidence / fallback quality review when
   * Analysis is still authoritative/current — those are advisory signals only.
   */
  analysisNeedsAttention?: boolean;
};

export type ProjectWorkflowStagePresentation = ProjectWorkflowStageDefinition & {
  status: ProjectWorkflowStatusLabel;
  /** Whether this stage is the active route context. */
  isActive: boolean;
  /**
   * Navigation destination within existing product routes.
   * Redesign uses Analysis with a focus hint until IA-4 — never a broken path.
   */
  destination: ProjectWorkflowDestination;
};

export type ProjectWorkflowDestination =
  | { kind: "route"; to: ProjectWorkflowRouteTo }
  | { kind: "embedded"; host: "analysis"; focus: "redesign" };

export type ProjectWorkflowRouteTo =
  | "/projects/$id/upload"
  | "/projects/$id/analysis"
  | "/projects/$id/estimate"
  | "/projects/$id/report";

/** Route path segments used to resolve the active stage (deterministic). */
export type ProjectWorkflowRouteContext =
  | { surface: "overview" }
  | { surface: "upload" }
  | { surface: "analysis"; focus?: "redesign" }
  | { surface: "estimate" }
  | { surface: "scope" }
  | { surface: "report" }
  | { surface: "other" };

/**
 * Map a route surface to the active workflow stage, or null when on Overview
 * (or another non-stage surface). Overview is never a stage.
 */
export function resolveActiveWorkflowStage(
  context: ProjectWorkflowRouteContext,
): ProjectWorkflowStageId | null {
  switch (context.surface) {
    case "upload":
      return "photos";
    case "analysis":
      return context.focus === "redesign" ? "redesign" : "analysis";
    case "estimate":
    case "scope":
      // Professional Scope is Estimate-family depth (IA-9), not a sixth stage.
      return "estimate";
    case "report":
      return "export";
    case "overview":
    case "other":
    default:
      return null;
  }
}

/**
 * Destination for a stage. Redesign intentionally does not invent
 * `/projects/$id/redesign` (IA-4). It points at the embedded Analysis surface
 * with a focus hint so navigation is never a dead link.
 */
export function stageDestination(stageId: ProjectWorkflowStageId): ProjectWorkflowDestination {
  switch (stageId) {
    case "photos":
      return { kind: "route", to: "/projects/$id/upload" };
    case "analysis":
      return { kind: "route", to: "/projects/$id/analysis" };
    case "redesign":
      return { kind: "embedded", host: "analysis", focus: "redesign" };
    case "estimate":
      return { kind: "route", to: "/projects/$id/estimate" };
    case "export":
      return { kind: "route", to: "/projects/$id/report" };
  }
}

/**
 * Conservative user-facing status from existing progress flags only.
 *
 * Limitations (documented for later IA phases):
 * - No provenance / revision / fingerprint currentness.
 * - No redesign_done authority — Redesign never reports Complete here.
 * - Complete requires the corresponding *_done flag (or photo evidence for Photos).
 * - Ready is used sparingly when upstream is done and the stage itself is not.
 * - Uncertain states stay Not started rather than fabricating Complete.
 */
export function resolveStageStatus(
  stageId: ProjectWorkflowStageId,
  progress: ProjectWorkflowProgressInput,
  activeStage: ProjectWorkflowStageId | null,
): ProjectWorkflowStatusLabel {
  const isActive = activeStage === stageId;

  switch (stageId) {
    case "photos": {
      if (progress.photosDone || (progress.photoCount !== undefined && progress.photoCount > 0)) {
        return "Complete";
      }
      if (isActive) return "In progress";
      return "Not started";
    }
    case "analysis": {
      if (progress.analysisDone) {
        return progress.analysisNeedsAttention ? "Needs attention" : "Complete";
      }
      if (isActive) return "In progress";
      if (progress.photosDone || (progress.photoCount !== undefined && progress.photoCount > 0)) {
        return "Ready";
      }
      return "Not started";
    }
    case "redesign": {
      // No redesign completion authority in IA-1 — never claim Complete.
      if (isActive) return "In progress";
      if (progress.analysisDone) return "Ready";
      return "Not started";
    }
    case "estimate": {
      if (progress.estimateDone) return "Complete";
      if (isActive) return "In progress";
      // After analysis, Estimate may be available; do not skip Redesign in the
      // presentation model (status Ready is not a permanent Analysis→Estimate
      // architecture — Redesign remains stage 3 in the journey).
      if (progress.analysisDone) return "Ready";
      return "Not started";
    }
    case "export": {
      if (progress.reportDone) return "Complete";
      if (isActive) return "In progress";
      if (progress.estimateDone) return "Ready";
      return "Not started";
    }
  }
}

/**
 * Build the full five-stage presentation list for shell / checklist consumers.
 */
export function buildProjectWorkflowStages(input: {
  progress: ProjectWorkflowProgressInput;
  route: ProjectWorkflowRouteContext;
}): ProjectWorkflowStagePresentation[] {
  const activeStage = resolveActiveWorkflowStage(input.route);

  return PROJECT_WORKFLOW_STAGES.map((stage) => ({
    ...stage,
    status: resolveStageStatus(stage.id, input.progress, activeStage),
    isActive: activeStage === stage.id,
    destination: stageDestination(stage.id),
  }));
}

/** Guard: status values must stay within the canonical user-facing vocabulary. */
export function isCanonicalWorkflowStatus(value: string): value is ProjectWorkflowStatusLabel {
  return (PROJECT_WORKFLOW_STATUS_LABELS as readonly string[]).includes(value);
}

/**
 * Build a short identity subtitle from optional property metadata.
 * Name-only projects MUST render without requiring address / postcode / type.
 */
export function buildProjectIdentitySubtitle(project: {
  address?: string | null;
  postcode?: string | null;
  property_type?: string | null;
}): string | undefined {
  const parts: string[] = [];
  const address = project.address?.trim();
  const postcode = project.postcode?.trim();
  const propertyType = project.property_type?.trim();

  if (address) parts.push(address);
  if (postcode) parts.push(postcode);
  // Only surface property type when address context is empty so name-only
  // shells stay calm; when address exists the type is secondary on Overview.
  if (!address && !postcode && propertyType) parts.push(propertyType);

  if (parts.length === 0) return undefined;
  return parts.join(" · ");
}

/**
 * Display title for project chrome. Prefers name; falls back to address only
 * when name is empty (legacy rows). Never requires address for a named project.
 */
export function buildProjectIdentityTitle(project: {
  name?: string | null;
  address?: string | null;
}): string {
  const name = project.name?.trim();
  if (name) return name;
  const address = project.address?.trim();
  if (address) return address;
  return "Untitled project";
}

/**
 * Map legacy project progress flags into the IA-1 progress input shape.
 * Pure adapter — no new done fields.
 */
export function progressFromProjectFlags(project: {
  photos_done?: boolean;
  analysis_done?: boolean;
  estimate_done?: boolean;
  report_done?: boolean;
}): Pick<
  ProjectWorkflowProgressInput,
  "photosDone" | "analysisDone" | "estimateDone" | "reportDone"
> {
  return {
    photosDone: Boolean(project.photos_done),
    analysisDone: Boolean(project.analysis_done),
    estimateDone: Boolean(project.estimate_done),
    reportDone: Boolean(project.report_done),
  };
}
