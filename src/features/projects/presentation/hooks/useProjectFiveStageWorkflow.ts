/**
 * IA-5 — Load durable five-stage evidence and compose ProjectWorkflowState.
 * Browser presentation helper; pure currentness lives in domain adapters.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getPhotoAnalysis,
  loadPhotoAnalysis,
  usePhotos,
  type RoomAnalysis,
} from "@/features/ai-upload";
import { listRedesignConceptsServerFn, type DurableRedesignConcept } from "@/features/ai-design";
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

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const cached = getPhotoAnalysis(projectId);
      const [persisted, durable, scope, est, snap] = await Promise.all([
        loadPhotoAnalysis(projectId).catch(() => [] as RoomAnalysis[]),
        listRedesignConceptsServerFn({ data: { projectId } }).catch(
          () => [] as DurableRedesignConcept[],
        ),
        getLatestScopeAuthorityHeader(projectId).catch(() => null),
        getLatestProjectEstimate(projectId).catch(() => null),
        getLatestExportSnapshot(projectId).catch(() => null),
      ]);
      const preferred =
        cached && cached.length > 0 ? cached : persisted && persisted.length > 0 ? persisted : [];
      setAnalyses(preferred);
      setCandidates(durable ?? []);
      setScopeHeader(scope);
      setEstimate(est);
      setExportSnap(snap);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Re-load once photo catalogue settles.
  useEffect(() => {
    if (photosLoading) return;
    if (analyses.length === 0 && (projectPhotos?.length ?? 0) > 0) {
      void reload();
    }
  }, [photosLoading, projectPhotos, analyses.length, reload]);

  const photos = useMemo(() => (projectPhotos ?? []).map((p) => ({ id: p.id })), [projectPhotos]);

  const currentAnalysisIdentity = useMemo(
    () =>
      [...analyses]
        .map((a) => a.photo_id)
        .filter((id): id is string => Boolean(id))
        .sort()
        .join("\u0001"),
    [analyses],
  );

  const selectedRedesignId = useMemo(
    () => candidates.find((c) => c.isSelected)?.id ?? null,
    [candidates],
  );

  const workflow = useMemo(() => {
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
    });
  }, [loading, photosLoading, photos, analyses, candidates, scopeHeader, estimate, exportSnap]);

  const nextAction = useMemo(() => {
    if (!workflow) return null;
    return resolveProjectNextAction({ projectId, workflow });
  }, [projectId, workflow]);

  const shellProgress = useMemo(() => {
    if (!workflow) return null;
    const estFlags = estimateShellFlagsFromCurrency(workflow.estimate.currency);
    const expFlags = exportShellFlagsFromCurrency(workflow.export.currency);
    // Redesign/analysis flags already mapped by currency patterns.
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
