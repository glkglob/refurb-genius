/**
 * Projects domain — pure workflow presentation model (IA-1).
 */
export {
  PROJECT_OVERVIEW_IS_WORKFLOW_STAGE,
  PROJECT_WORKFLOW_STAGE_IDS,
  PROJECT_WORKFLOW_STAGES,
  PROJECT_WORKFLOW_STATUS_LABELS,
  buildProjectIdentitySubtitle,
  buildProjectIdentityTitle,
  buildProjectWorkflowStages,
  isCanonicalWorkflowStatus,
  progressFromProjectFlags,
  resolveActiveWorkflowStage,
  resolveStageStatus,
  stageDestination,
  type ProjectWorkflowDestination,
  type ProjectWorkflowProgressInput,
  type ProjectWorkflowRouteContext,
  type ProjectWorkflowRouteTo,
  type ProjectWorkflowStageDefinition,
  type ProjectWorkflowStageId,
  type ProjectWorkflowStagePresentation,
  type ProjectWorkflowStatusLabel,
} from "./workflowStages";
