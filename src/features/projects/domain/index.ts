/**
 * Projects domain — pure workflow presentation (IA-1) and next-action resolver (IA-2).
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

export {
  PROJECT_NEXT_ACTION_KINDS,
  PROJECT_NEXT_ACTION_LABELS,
  PROJECT_STAGE_PROGRESS_LABELS,
  isProjectNextActionKind,
  type ProjectNextActionKind,
} from "./nextActionKinds";

export {
  PROJECT_NEXT_ACTION_REASONS,
  type AnalysisWorkflowState,
  type EstimateWorkflowState,
  type ExportWorkflowState,
  type PhotosWorkflowState,
  type ProjectNextActionReason,
  type ProjectWorkflowEntitlements,
  type ProjectWorkflowState,
  type RedesignWorkflowState,
  type ScopeWorkflowState,
  type WorkflowAuthorityCurrency,
} from "./projectWorkflowState";

export {
  buildProjectNextActionRoute,
  resolveProjectNextAction,
  type ProjectNextAction,
  type ResolveProjectNextActionInput,
} from "./resolveProjectNextAction";

export {
  analysisCurrencyFromEvidence,
  analysisShellFlagsFromCurrency,
  buildPhotosAnalysisWorkflowState,
  photosCurrencyFromEvidence,
  type AnalysisAuthorityEvidence,
  type DurablePhotoIdentity,
  type PhotosAnalysisAdapterInput,
} from "./photosAnalysisWorkflowAdapter";

export {
  redesignCurrencyFromEvidence,
  redesignShellFlagsFromCurrency,
  type RedesignAdapterInput,
  type RedesignCandidateEvidence,
} from "./redesignWorkflowAdapter";

export {
  scopeCurrencyFromEvidence,
  scopeShellFlagsFromCurrency,
  type ScopeAdapterInput,
  type ScopeAuthorityEvidence,
} from "./scopeWorkflowAdapter";

export {
  estimateCurrencyFromEvidence,
  estimateShellFlagsFromCurrency,
  type EstimateAdapterInput,
  type EstimateAuthorityEvidence,
} from "./estimateWorkflowAdapter";

export {
  exportCurrencyFromEvidence,
  exportShellFlagsFromCurrency,
  type ExportAdapterInput,
  type ExportSnapshotEvidence,
} from "./exportWorkflowAdapter";

export {
  composeProjectWorkflowState,
  type ComposeProjectWorkflowStateInput,
} from "./composeProjectWorkflowState";

export {
  explainProjectNextActionReason,
  workflowAllStagesComplete,
  workflowHasNeedsAttention,
} from "./explainProjectNextActionReason";
