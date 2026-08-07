/**
 * Project workflow checklist helpers — converged on IA-0 five-stage journey.
 *
 * Canonical authority lives in `@/features/projects` domain model.
 * This module is a thin compatibility adapter for existing consumers
 * (upload / analysis routes). Do not reintroduce an independent three-stage
 * Upload → Analyse → Estimate workflow representation.
 */
import {
  buildProjectWorkflowStages,
  type ProjectWorkflowProgressInput,
  type ProjectWorkflowRouteContext,
  type ProjectWorkflowStageId,
  type ProjectWorkflowStagePresentation,
  type ProjectWorkflowStatusLabel,
} from "@/features/projects";

/** @deprecated Prefer ProjectWorkflowStageId — retained for gradual migration. */
export type PipelineStepId = ProjectWorkflowStageId;

/** @deprecated Prefer ProjectWorkflowStatusLabel mapping via buildProjectPipelineSteps. */
export type PipelineStepState = "complete" | "current" | "pending" | "error";

export type PipelineStep = {
  id: PipelineStepId;
  label: string;
  description?: string;
  state: PipelineStepState;
  /** User-facing status text (canonical vocabulary). */
  statusLabel: ProjectWorkflowStatusLabel;
  isActive: boolean;
};

function statusToLegacyState(
  status: ProjectWorkflowStatusLabel,
  isActive: boolean,
): PipelineStepState {
  if (status === "Complete") return "complete";
  if (status === "Needs attention") return "error";
  if (isActive || status === "In progress") return "current";
  return "pending";
}

function toPipelineStep(stage: ProjectWorkflowStagePresentation): PipelineStep {
  return {
    id: stage.id,
    label: stage.label,
    description: stage.description,
    state: statusToLegacyState(stage.status, stage.isActive),
    statusLabel: stage.status,
    isActive: stage.isActive,
  };
}

/**
 * Build the canonical five-stage checklist for a project surface.
 *
 * Replaces the former three-step Upload → Analyse → Estimate helper.
 */
export function buildProjectPipelineSteps(input: {
  photoCount: number;
  analysisComplete: boolean;
  analysisHasFallback?: boolean;
  estimateComplete: boolean;
  reportComplete?: boolean;
  /** Active surface — drives active-stage presentation. */
  current: "upload" | "analyse" | "analysis" | "redesign" | "estimate" | "export" | "report";
}): PipelineStep[] {
  const progress: ProjectWorkflowProgressInput = {
    photosDone: input.photoCount > 0,
    analysisDone: input.analysisComplete,
    estimateDone: input.estimateComplete,
    reportDone: Boolean(input.reportComplete),
    photoCount: input.photoCount,
    analysisNeedsAttention: Boolean(input.analysisHasFallback),
  };

  const route: ProjectWorkflowRouteContext = (() => {
    switch (input.current) {
      case "upload":
        return { surface: "upload" };
      case "analyse":
      case "analysis":
        return { surface: "analysis" };
      case "redesign":
        return { surface: "analysis", focus: "redesign" };
      case "estimate":
        return { surface: "estimate" };
      case "export":
      case "report":
        return { surface: "report" };
      default:
        return { surface: "other" };
    }
  })();

  return buildProjectWorkflowStages({ progress, route }).map(toPipelineStep);
}

/** Canonical stage labels — single source for invariants / tests. */
export const CANONICAL_PIPELINE_STAGE_LABELS = [
  "Photos",
  "Analysis",
  "Redesign",
  "Estimate",
  "Export",
] as const;
