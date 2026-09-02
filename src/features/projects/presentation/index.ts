export {
  ProjectWorkflowShell,
  ProjectStageNav,
  ProjectContinuationCard,
  NewProjectEntry,
  MobileStickyNextAction,
  type ProjectWorkflowShellProject,
  type ProjectWorkflowStickyNextAction,
  type ProjectContinuationCardProps,
  type MobileStickyNextActionProps,
  ProjectBrief,
  WorkflowBoard,
  WorkflowBoardItem,
  type ProjectBriefProps,
  type WorkflowBoardProps,
  type WorkflowBoardItemProps,
} from "./components";

export {
  useProjectFiveStageWorkflow,
  type ProjectFiveStageWorkflowResult,
} from "./hooks/useProjectFiveStageWorkflow";

export { useProjectWorkflowOperationFlags } from "./hooks/useProjectWorkflowOperationFlags";

export {
  useDashboardProjectSummaries,
  type DashboardProjectSummariesResult,
} from "./hooks/useDashboardProjectSummaries";
export {
  useProjectBriefVisibility,
  projectBriefVisibilityKey,
  PROJECT_BRIEF_VISIBILITY_KEY_PREFIX,
  type ProjectBriefVisibilityState,
} from "./hooks/useProjectBriefVisibility";
export {
  briefActionableItems,
  briefStatusCounts,
  deriveCurrentScopeIdForEstimate,
  groupSummariesByStage,
  toDashboardProjectSummary,
  workflowBoardColumns,
  type DashboardBriefCounts,
  type DashboardProjectSummary,
  type DashboardStageColumn,
} from "./dashboardProjectSummary";

export {
  beginProjectWorkflowOperation,
  endProjectWorkflowOperation,
  getProjectWorkflowOperationFlags,
  resetProjectWorkflowOperationRegistryForTests,
  setProjectWorkflowOperationRunning,
  subscribeProjectWorkflowOperations,
  withProjectWorkflowOperationRunning,
  type ProjectWorkflowOperationFlags,
  type ProjectWorkflowOperationStage,
} from "./projectWorkflowOperationRegistry";
