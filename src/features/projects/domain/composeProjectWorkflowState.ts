/**
 * IA-5 — Compose full ProjectWorkflowState from stage evidence.
 *
 * Pure: no React, Supabase, AI, or mutation.
 */

import {
  currentSelectedRedesignId,
  resolveCurrentAnalysisIdentity,
} from "@/features/ai-design/domain";
import type { ProjectWorkflowState, WorkflowAuthorityCurrency } from "./projectWorkflowState";
import {
  analysisCurrencyFromEvidence,
  photosCurrencyFromEvidence,
  type AnalysisAuthorityEvidence,
  type DurablePhotoIdentity,
} from "./photosAnalysisWorkflowAdapter";
import {
  redesignCurrencyFromEvidence,
  type RedesignCandidateEvidence,
} from "./redesignWorkflowAdapter";
import { scopeCurrencyFromEvidence, type ScopeAuthorityEvidence } from "./scopeWorkflowAdapter";
import {
  estimateCurrencyFromEvidence,
  type EstimateAuthorityEvidence,
} from "./estimateWorkflowAdapter";
import { exportCurrencyFromEvidence, type ExportSnapshotEvidence } from "./exportWorkflowAdapter";

export type ComposeProjectWorkflowStateInput = {
  photos: DurablePhotoIdentity[];
  analyses: AnalysisAuthorityEvidence[];
  redesignCandidates: RedesignCandidateEvidence[];
  scope: ScopeAuthorityEvidence | null;
  estimate: EstimateAuthorityEvidence | null;
  exportSnapshot: ExportSnapshotEvidence | null;
  photosOperationRunning?: boolean;
  analysisOperationRunning?: boolean;
  redesignOperationRunning?: boolean;
  scopeOperationRunning?: boolean;
  estimateOperationRunning?: boolean;
  exportOperationRunning?: boolean;
};

/**
 * Build the full six-authority currency graph for resolveProjectNextAction.
 * Customer stages remain five: Photos → Analysis → Redesign → Estimate → Export.
 */
export function composeProjectWorkflowState(
  input: ComposeProjectWorkflowStateInput,
): ProjectWorkflowState {
  const photos = photosCurrencyFromEvidence({
    photos: input.photos,
    photosOperationRunning: input.photosOperationRunning,
  });
  const analysis = analysisCurrencyFromEvidence({
    photos: input.photos,
    analyses: input.analyses,
    analysisOperationRunning: input.analysisOperationRunning,
  });

  const currentAnalysisIdentity = resolveCurrentAnalysisIdentity({
    analysisIsCurrent: analysis.currency === "current",
    photoIds: input.analyses.map((a) => a.photoId),
  });

  const redesign = redesignCurrencyFromEvidence({
    analysisCurrency: analysis.currency,
    currentAnalysisIdentity,
    candidates: input.redesignCandidates,
    redesignOperationRunning: input.redesignOperationRunning,
  });

  const currentSelectedRedesignIdentity =
    currentSelectedRedesignId(input.redesignCandidates, {
      analysisIsCurrent: analysis.currency === "current",
      currentAnalysisIdentity,
    }) ?? "";

  const scope = scopeCurrencyFromEvidence({
    analysisCurrency: analysis.currency,
    redesignCurrency: redesign.currency,
    currentAnalysisIdentity,
    currentSelectedRedesignIdentity,
    scope: input.scope,
    scopeOperationRunning: input.scopeOperationRunning,
  });

  const currentScopeId =
    scope.currency === "current" && input.scope ? input.scope.id : (input.scope?.id ?? "");

  const estimate = estimateCurrencyFromEvidence({
    scopeCurrency: scope.currency,
    currentScopeId: scope.currency === "current" ? currentScopeId : "",
    estimate: input.estimate,
    estimateOperationRunning: input.estimateOperationRunning,
  });

  const currentEstimateId =
    estimate.currency === "current" && input.estimate
      ? input.estimate.id
      : (input.estimate?.id ?? "");

  const exp = exportCurrencyFromEvidence({
    estimateCurrency: estimate.currency,
    currentEstimateId: estimate.currency === "current" ? currentEstimateId : "",
    snapshot: input.exportSnapshot,
    exportOperationRunning: input.exportOperationRunning,
  });

  return {
    photos,
    analysis,
    redesign,
    scope,
    estimate,
    export: exp,
  };
}

/** Diagnostic helper for tests. */
export function currencyOf(
  workflow: ProjectWorkflowState,
  key: keyof ProjectWorkflowState,
): WorkflowAuthorityCurrency {
  return workflow[key].currency;
}
