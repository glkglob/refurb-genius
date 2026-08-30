/**
 * Dashboard Home shared read-only summary: identity + resolver output.
 * Classification stays in composeProjectWorkflowState / resolveProjectNextAction.
 */
import {
  PROJECT_WORKFLOW_STAGE_IDS,
  PROJECT_WORKFLOW_STAGES,
  buildProjectIdentitySubtitle,
  buildProjectIdentityTitle,
  buildProjectWorkflowStages,
  composeProjectWorkflowState,
  estimateShellFlagsFromCurrency,
  explainProjectNextActionReason,
  exportShellFlagsFromCurrency,
  type AnalysisAuthorityEvidence,
  type DurablePhotoIdentity,
  type ProjectNextAction,
  type ProjectNextActionKind,
  type ProjectNextActionReason,
  type ProjectWorkflowProgressInput,
  type ProjectWorkflowStageId,
  type ProjectWorkflowStagePresentation,
  type ProjectWorkflowState,
  type ProjectWorkflowStatusLabel,
  type RedesignCandidateEvidence,
  type ScopeAuthorityEvidence,
} from "../domain";

export type DashboardProjectSummary = {
  projectId: string;
  name: string;
  location: string;
  stage: ProjectWorkflowStageId;
  stageLabel: string;
  status: ProjectWorkflowStatusLabel;
  nextActionKind: ProjectNextActionKind;
  nextActionLabel: string;
  reason: ProjectNextActionReason;
  reasonExplanation: string;
  workflowRoute: string;
  overviewRoute: string;
  listOrder: number;
  workflowStages: ProjectWorkflowStagePresentation[];
};

export type DashboardBriefCounts = {
  needsAttention: number;
  inProgress: number;
  ready: number;
  complete: number;
};

export type DashboardStageColumn = {
  id: ProjectWorkflowStageId;
  label: string;
  count: number;
  projects: DashboardProjectSummary[];
};

type IdentityProject = {
  id: string;
  name?: string | null;
  address?: string | null;
  postcode?: string | null;
  property_type?: string | null;
  region?: string | null;
};

export function deriveCurrentScopeIdForEstimate(input: {
  photos: DurablePhotoIdentity[];
  analyses: AnalysisAuthorityEvidence[];
  redesignCandidates: RedesignCandidateEvidence[];
  scope: ScopeAuthorityEvidence | null;
}): string | null {
  const workflow = composeProjectWorkflowState({
    photos: input.photos,
    analyses: input.analyses,
    redesignCandidates: input.redesignCandidates,
    scope: input.scope,
    estimate: null,
    exportSnapshot: null,
  });
  return workflow.scope.currency === "current" && input.scope ? input.scope.id : null;
}

/**
 * Same shell-progress mapping as useProjectFiveStageWorkflow.
 * Presentation only — does not classify evidence or invent a second workflow model.
 */
export function shellProgressFromWorkflow(
  workflow: ProjectWorkflowState,
): ProjectWorkflowProgressInput {
  const estFlags = estimateShellFlagsFromCurrency(workflow.estimate.currency);
  const expFlags = exportShellFlagsFromCurrency(workflow.export.currency);
  const analysisDone =
    workflow.analysis.currency === "current" || workflow.analysis.currency === "non_current";
  const redesignDone =
    workflow.redesign.currency === "current" || workflow.redesign.currency === "non_current";
  return {
    photosDone: workflow.photos.currency === "current",
    analysisDone,
    analysisNeedsAttention: workflow.analysis.currency === "non_current",
    redesignDone,
    redesignNeedsAttention: workflow.redesign.currency === "non_current",
    estimateDone: estFlags.estimateDone,
    estimateNeedsAttention:
      estFlags.estimateNeedsAttention ||
      workflow.scope.currency === "non_current" ||
      (workflow.scope.currency === "absent" &&
        workflow.redesign.currency === "current" &&
        workflow.analysis.currency === "current"),
    reportDone: expFlags.reportDone,
    reportNeedsAttention: expFlags.reportNeedsAttention,
  };
}

export function buildDashboardWorkflowStages(
  workflow: ProjectWorkflowState,
): ProjectWorkflowStagePresentation[] {
  return buildProjectWorkflowStages({
    progress: shellProgressFromWorkflow(workflow),
    route: { surface: "overview" },
  });
}

export function toDashboardProjectSummary(
  project: IdentityProject,
  nextAction: ProjectNextAction,
  listOrder: number,
  workflowStages: readonly ProjectWorkflowStagePresentation[],
): DashboardProjectSummary {
  const stage = PROJECT_WORKFLOW_STAGES.find((item) => item.id === nextAction.stage);
  const subtitle = buildProjectIdentitySubtitle(project);
  const location =
    subtitle ??
    ([project.address, project.postcode].filter(Boolean).join(", ") ||
      project.region?.trim() ||
      "");
  return {
    projectId: project.id,
    name: buildProjectIdentityTitle(project),
    location,
    stage: nextAction.stage,
    stageLabel: stage?.label ?? nextAction.stage,
    status: nextAction.status,
    nextActionKind: nextAction.actionKind,
    nextActionLabel: nextAction.label,
    reason: nextAction.reason,
    reasonExplanation: explainProjectNextActionReason(nextAction.reason),
    workflowRoute: nextAction.route,
    overviewRoute: `/projects/${project.id}`,
    listOrder,
    workflowStages: [...workflowStages],
  };
}

export function groupSummariesByStage(
  summaries: readonly DashboardProjectSummary[],
): Record<ProjectWorkflowStageId, DashboardProjectSummary[]> {
  const groups = Object.fromEntries(
    PROJECT_WORKFLOW_STAGE_IDS.map((id) => [id, [] as DashboardProjectSummary[]]),
  ) as Record<ProjectWorkflowStageId, DashboardProjectSummary[]>;
  const ordered = [...summaries].sort((a, b) => a.listOrder - b.listOrder);
  for (const summary of ordered) {
    groups[summary.stage].push(summary);
  }
  return groups;
}

export function workflowBoardColumns(
  summaries: readonly DashboardProjectSummary[],
): DashboardStageColumn[] {
  const groups = groupSummariesByStage(summaries);
  return PROJECT_WORKFLOW_STAGES.map((stage) => ({
    id: stage.id,
    label: stage.label,
    count: groups[stage.id].length,
    projects: groups[stage.id],
  }));
}

export function briefStatusCounts(
  summaries: readonly DashboardProjectSummary[],
): DashboardBriefCounts {
  return {
    needsAttention: summaries.filter((item) => item.status === "Needs attention").length,
    inProgress: summaries.filter((item) => item.status === "In progress").length,
    ready: summaries.filter((item) => item.status === "Ready").length,
    complete: summaries.filter(
      (item) => item.status === "Complete" || item.nextActionKind === "view_completed_project",
    ).length,
  };
}

function briefRank(summary: DashboardProjectSummary): number {
  if (summary.status === "Needs attention") return 0;
  if (summary.status === "In progress") return 1;
  if (summary.status === "Ready") return 2;
  return 99;
}

export function briefActionableItems(
  summaries: readonly DashboardProjectSummary[],
  max = 3,
): DashboardProjectSummary[] {
  return [...summaries]
    .filter((item) => briefRank(item) < 99)
    .sort((a, b) => {
      const rank = briefRank(a) - briefRank(b);
      if (rank !== 0) return rank;
      return a.listOrder - b.listOrder;
    })
    .slice(0, max);
}
