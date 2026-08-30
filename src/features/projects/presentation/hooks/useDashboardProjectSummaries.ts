import { useCallback, useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { estimateAuthorityEvidenceFromRow } from "@/features/estimate";
import { photosQueryOptions, projectKeys } from "@/lib/queries/projects";
import type { ProjectWithProgress } from "@/lib/mappers";
import {
  composeProjectWorkflowState,
  resolveProjectNextAction,
  type AnalysisAuthorityEvidence,
  type DurablePhotoIdentity,
  type RedesignCandidateEvidence,
  type ScopeAuthorityEvidence,
} from "../../domain";
import {
  buildDashboardWorkflowStages,
  deriveCurrentScopeIdForEstimate,
  toDashboardProjectSummary,
  type DashboardProjectSummary,
} from "../dashboardProjectSummary";
import {
  workflowExportSnapshotQueryOptions,
  workflowProjectEstimateQueryOptions,
  workflowRedesignConceptsQueryOptions,
  workflowRoomAnalysesQueryOptions,
  workflowScopeHeaderQueryOptions,
} from "../workflowEvidenceQueryOptions";

export type DashboardProjectSummariesResult = {
  status: "loading" | "error" | "ready";
  summaries: DashboardProjectSummary[];
  error: Error | null;
  retry: () => void;
};

type QueryLike = {
  isSuccess: boolean;
  isError: boolean;
  error: unknown;
  data: unknown;
};

function packError(pack: QueryLike[]): Error | null {
  const failed = pack.find((query) => query.isError);
  if (!failed) return null;
  return failed.error instanceof Error ? failed.error : new Error("Workflow evidence failed");
}

function toPhotos(data: unknown): DurablePhotoIdentity[] {
  if (!Array.isArray(data)) return [];
  return data.map((row) => ({ id: String((row as { id: string }).id) }));
}

function toAnalyses(data: unknown): AnalysisAuthorityEvidence[] {
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const analysis = row as { photo_id?: string | null; source?: string | null };
    return { photoId: analysis.photo_id, source: analysis.source };
  });
}

function toRedesign(data: unknown): RedesignCandidateEvidence[] {
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const concept = row as {
      id: string;
      style: string;
      analysisIdentity: string;
      isSelected: boolean;
    };
    return {
      id: concept.id,
      style: concept.style,
      analysisIdentity: concept.analysisIdentity,
      isSelected: concept.isSelected,
    };
  });
}

function toScope(data: unknown): ScopeAuthorityEvidence | null {
  if (!data || typeof data !== "object") return null;
  const header = data as {
    id: string;
    analysisIdentity: string;
    redesignIdentity: string;
  };
  return {
    id: header.id,
    analysisIdentity: header.analysisIdentity,
    redesignIdentity: header.redesignIdentity,
  };
}

export function useDashboardProjectSummaries(
  projects: readonly ProjectWithProgress[],
): DashboardProjectSummariesResult {
  const queryClient = useQueryClient();
  const ids = projects.map((project) => project.id);

  const photoQueries = useQueries({
    queries: ids.map((id) => photosQueryOptions(id)),
  });
  const analysisQueries = useQueries({
    queries: ids.map((id) => workflowRoomAnalysesQueryOptions(id)),
  });
  const redesignQueries = useQueries({
    queries: ids.map((id) => workflowRedesignConceptsQueryOptions(id)),
  });
  const scopeQueries = useQueries({
    queries: ids.map((id) => workflowScopeHeaderQueryOptions(id)),
  });
  const exportQueries = useQueries({
    queries: ids.map((id) => workflowExportSnapshotQueryOptions(id)),
  });

  const firstWave = ids.map((_, index) => {
    const pack = [
      photoQueries[index],
      analysisQueries[index],
      redesignQueries[index],
      scopeQueries[index],
      exportQueries[index],
    ] as QueryLike[];
    return {
      success: pack.every((query) => query.isSuccess),
      error: packError(pack),
      photos: toPhotos(photoQueries[index]?.data),
      analyses: toAnalyses(analysisQueries[index]?.data),
      redesign: toRedesign(redesignQueries[index]?.data),
      scope: toScope(scopeQueries[index]?.data),
      exportSnapshot: exportQueries[index]?.data as
        | { id: string; estimateId: string }
        | null
        | undefined,
    };
  });

  const estimateQueries = useQueries({
    queries: ids.map((id, index) => {
      const wave = firstWave[index];
      const currentScopeId = wave?.success
        ? deriveCurrentScopeIdForEstimate({
            photos: wave.photos,
            analyses: wave.analyses,
            redesignCandidates: wave.redesign,
            scope: wave.scope,
          })
        : null;
      return {
        ...workflowProjectEstimateQueryOptions(id, currentScopeId),
        enabled: Boolean(wave?.success),
      };
    }),
  });

  const retry = useCallback(() => {
    for (const id of ids) {
      void queryClient.invalidateQueries({ queryKey: projectKeys.photosByProject(id) });
      void queryClient.invalidateQueries({ queryKey: ["projects", id, "workflow"] });
    }
  }, [ids, queryClient]);

  return useMemo(() => {
    if (ids.length === 0) {
      return { status: "ready", summaries: [], error: null, retry };
    }

    const firstWaveError = firstWave.find((wave) => wave.error)?.error ?? null;
    if (firstWaveError) {
      return { status: "error", summaries: [], error: firstWaveError, retry };
    }
    if (firstWave.some((wave) => !wave.success)) {
      return { status: "loading", summaries: [], error: null, retry };
    }

    const estimateError = packError(estimateQueries as QueryLike[]);
    if (estimateError) {
      return { status: "error", summaries: [], error: estimateError, retry };
    }
    if (estimateQueries.some((query) => !query.isSuccess)) {
      return { status: "loading", summaries: [], error: null, retry };
    }

    const summaries = projects.map((project, index) => {
      const wave = firstWave[index];
      const estimateRow = estimateQueries[index]?.data;
      const estimate = estimateRow ? estimateAuthorityEvidenceFromRow(estimateRow.estimate) : null;
      const workflow = composeProjectWorkflowState({
        photos: wave.photos,
        analyses: wave.analyses,
        redesignCandidates: wave.redesign,
        scope: wave.scope,
        estimate,
        exportSnapshot: wave.exportSnapshot
          ? { id: wave.exportSnapshot.id, estimateId: wave.exportSnapshot.estimateId }
          : null,
      });
      const nextAction = resolveProjectNextAction({ projectId: project.id, workflow });
      return toDashboardProjectSummary(
        project,
        nextAction,
        index,
        buildDashboardWorkflowStages(workflow),
      );
    });

    return { status: "ready", summaries, error: null, retry };
  }, [estimateQueries, firstWave, ids.length, projects, retry]);
}
