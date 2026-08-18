/**
 * IA-5 — Load durable five-stage evidence and compose ProjectWorkflowState.
 * Browser presentation helper; pure currentness lives in domain adapters.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  durablePhotoCatalogueIdentity,
  getPhotoAnalysis,
  isProductionValidAnalysisSet,
  loadPhotoAnalysis,
  preferAnalysesForCurrentCatalogue,
  subscribePhotoAnalysis,
  usePhotos,
  type RoomAnalysis,
} from "@/features/ai-upload";
import {
  currentSelectedRedesignId,
  listRedesignConceptsForClient,
  resolveCurrentAnalysisIdentity,
  type DurableRedesignConcept,
} from "@/features/ai-design";
import { getLatestScopeAuthorityHeader } from "@/features/ai-design/infrastructure";
import {
  getLatestProjectEstimate,
  estimateAuthorityEvidenceFromRow,
  type PersistedProjectEstimate,
} from "@/features/estimate";
import { getLatestExportSnapshot } from "@/features/export/infrastructure";
import {
  composeProjectWorkflowState,
  estimateShellFlagsFromCurrency,
  exportShellFlagsFromCurrency,
  resolveProjectNextAction,
  type ProjectNextAction,
  type ProjectWorkflowState,
} from "../../domain";
import { logger } from "@/lib/logger";
import { useProjectWorkflowOperationFlags } from "./useProjectWorkflowOperationFlags";

export type ProjectFiveStageWorkflowResult = {
  loading: boolean;
  workflow: ProjectWorkflowState | null;
  nextAction: ProjectNextAction | null;
  shellProgress: {
    photosDone: boolean;
    analysisDone: boolean;
    analysisNeedsAttention: boolean;
    redesignDone: boolean;
    redesignNeedsAttention: boolean;
    estimateDone: boolean;
    estimateNeedsAttention: boolean;
    reportDone: boolean;
    reportNeedsAttention: boolean;
  } | null;
  scopeId: string | null;
  estimateId: string | null;
  currentAnalysisIdentity: string;
  selectedRedesignId: string | null;
  reload: () => Promise<void>;
};

export function useProjectFiveStageWorkflow(projectId: string): ProjectFiveStageWorkflowResult {
  const { data: projectPhotos, isLoading: photosLoading } = usePhotos(projectId);
  // IA-6-R1: cross-route transient operation signals (not initial data loading).
  const operationFlags = useProjectWorkflowOperationFlags(projectId);
  const [loading, setLoading] = useState(true);
  const [analyses, setAnalyses] = useState<RoomAnalysis[]>([]);
  const [candidates, setCandidates] = useState<DurableRedesignConcept[]>([]);
  const [scopeHeader, setScopeHeader] = useState<Awaited<
    ReturnType<typeof getLatestScopeAuthorityHeader>
  > | null>(null);
  const [estimate, setEstimate] = useState<PersistedProjectEstimate | null>(null);
  const [exportSnap, setExportSnap] = useState<Awaited<
    ReturnType<typeof getLatestExportSnapshot>
  > | null>(null);

  const catalogueIdentity = useMemo(
    () => durablePhotoCatalogueIdentity((projectPhotos ?? []).map((p) => ({ id: p.id }))),
    [projectPhotos],
  );
  const projectPhotosRef = useRef(projectPhotos);
  projectPhotosRef.current = projectPhotos;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // catalogueIdentity is the reload key: membership change must rebuild evidence.
      const catalogue = (projectPhotosRef.current ?? []).map((p) => ({
        id: p.id,
        url: p.url,
        name: p.name,
      }));
      void catalogueIdentity;
      const cached = getPhotoAnalysis(projectId);
      const [persisted, durableSettled, scope, snap] = await Promise.all([
        loadPhotoAnalysis(projectId).catch(() => [] as RoomAnalysis[]),
        listRedesignConceptsForClient(projectId).then(
          (value) => ({ ok: true as const, value }),
          (error: unknown) => ({ ok: false as const, error }),
        ),
        getLatestScopeAuthorityHeader(projectId).catch(() => null),
        getLatestExportSnapshot(projectId).catch(() => null),
      ]);
      if (!durableSettled.ok) {
        logger.error("[five-stage] redesign concepts load failed", {
          message: durableSettled.error instanceof Error ? durableSettled.error.message : "unknown",
        });
      }
      const durable = durableSettled.ok ? durableSettled.value : [];
      const preferred = preferAnalysesForCurrentCatalogue({
        cached,
        persisted,
        catalogue,
      });
      const analysisIsCurrent = isProductionValidAnalysisSet(preferred, catalogue);
      const analysisIdentity = resolveCurrentAnalysisIdentity({
        analysisIsCurrent,
        photoIds: preferred.map((a) => a.photo_id),
      });
      const selectedId = currentSelectedRedesignId(durable, {
        analysisIsCurrent,
        currentAnalysisIdentity: analysisIdentity,
      });
      // IA-5-R2: only pass Scope id when it matches current Analysis + selected Redesign.
      const currentScopeId =
        scope &&
        selectedId &&
        scope.analysisIdentity === analysisIdentity &&
        scope.redesignIdentity === selectedId
          ? scope.id
          : null;
      const est = await getLatestProjectEstimate(projectId, currentScopeId).catch(() => null);
      setAnalyses(preferred);
      setCandidates(durable);
      setScopeHeader(scope);
      setEstimate(est);
      setExportSnap(snap);
    } finally {
      setLoading(false);
    }
  }, [projectId, catalogueIdentity]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(
    () =>
      subscribePhotoAnalysis(projectId, () => {
        void reload();
      }),
    [projectId, reload],
  );

  const photos = useMemo(() => (projectPhotos ?? []).map((p) => ({ id: p.id })), [projectPhotos]);
  const catalogue = useMemo(
    () => (projectPhotos ?? []).map((p) => ({ id: p.id, url: p.url, name: p.name })),
    [projectPhotos],
  );

  const analysisIsCurrent = useMemo(
    () => isProductionValidAnalysisSet(analyses, catalogue),
    [analyses, catalogue],
  );

  const currentAnalysisIdentity = useMemo(
    () =>
      resolveCurrentAnalysisIdentity({
        analysisIsCurrent,
        photoIds: analyses.map((a) => a.photo_id),
      }),
    [analysisIsCurrent, analyses],
  );

  const selectedRedesignId = useMemo(
    () =>
      currentSelectedRedesignId(candidates, {
        analysisIsCurrent,
        currentAnalysisIdentity,
      }),
    [candidates, analysisIsCurrent, currentAnalysisIdentity],
  );

  const workflow = useMemo(() => {
    // Loading evidence ≠ operation running. Keep workflow null while hydrating so
    // consumers show Loading, not view_stage_progress.
    if (loading || photosLoading) return null;
    return composeProjectWorkflowState({
      photos,
      analyses: analyses.map((a) => ({ photoId: a.photo_id, source: a.source })),
      redesignCandidates: candidates.map((c) => ({
        id: c.id,
        style: c.style,
        analysisIdentity: c.analysisIdentity,
        isSelected: c.isSelected,
      })),
      scope: scopeHeader
        ? {
            id: scopeHeader.id,
            analysisIdentity: scopeHeader.analysisIdentity,
            redesignIdentity: scopeHeader.redesignIdentity,
          }
        : null,
      estimate: estimate ? estimateAuthorityEvidenceFromRow(estimate.estimate) : null,
      exportSnapshot: exportSnap ? { id: exportSnap.id, estimateId: exportSnap.estimateId } : null,
      photosOperationRunning: operationFlags.photosOperationRunning,
      analysisOperationRunning: operationFlags.analysisOperationRunning,
      redesignOperationRunning: operationFlags.redesignOperationRunning,
      scopeOperationRunning: operationFlags.scopeOperationRunning,
      estimateOperationRunning: operationFlags.estimateOperationRunning,
      exportOperationRunning: operationFlags.exportOperationRunning,
    });
  }, [
    loading,
    photosLoading,
    photos,
    analyses,
    candidates,
    scopeHeader,
    estimate,
    exportSnap,
    operationFlags,
  ]);

  const nextAction = useMemo(() => {
    if (!workflow) return null;
    return resolveProjectNextAction({ projectId, workflow });
  }, [projectId, workflow]);

  const shellProgress = useMemo(() => {
    if (!workflow) return null;
    const estFlags = estimateShellFlagsFromCurrency(workflow.estimate.currency);
    const expFlags = exportShellFlagsFromCurrency(workflow.export.currency);
    // Redesign/analysis flags already mapped by currency patterns.
    // Running stages are not Complete and not Needs attention in shell progress
    // (In progress is represented via isActive / resolver CTA, not done flags).
    const analysisDone =
      workflow.analysis.currency === "current" || workflow.analysis.currency === "non_current";
    const redesignDone = workflow.redesign.currency === "current";
    return {
      photosDone: workflow.photos.currency === "current",
      analysisDone,
      analysisNeedsAttention: workflow.analysis.currency === "non_current",
      redesignDone,
      redesignNeedsAttention: workflow.redesign.currency === "non_current",
      estimateDone: estFlags.estimateDone,
      // Scope dependency surfaces on Estimate stage as Needs attention.
      estimateNeedsAttention:
        estFlags.estimateNeedsAttention ||
        workflow.scope.currency === "non_current" ||
        (workflow.scope.currency === "absent" &&
          workflow.redesign.currency === "current" &&
          workflow.analysis.currency === "current"),
      reportDone: expFlags.reportDone,
      reportNeedsAttention: expFlags.reportNeedsAttention,
    };
  }, [workflow]);

  return {
    loading: loading || photosLoading,
    workflow,
    nextAction,
    shellProgress,
    scopeId: scopeHeader?.id ?? null,
    estimateId: estimate?.estimate.id ?? null,
    currentAnalysisIdentity,
    selectedRedesignId,
    reload,
  };
}
