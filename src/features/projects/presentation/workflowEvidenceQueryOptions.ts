/**
 * Dashboard/Home workflow-evidence React Query factories.
 *
 * Query keys and option objects only. Persistence stays in owning repositories
 * and existing list adapters. Photos continue to use photosQueryOptions.
 */
import { queryOptions } from "@tanstack/react-query";
import { listRedesignConceptsForClient, type DurableRedesignConcept } from "@/features/ai-design";
import {
  getLatestScopeAuthorityHeaderStrict,
  type ScopeAuthorityHeader,
} from "@/features/ai-design/infrastructure";
import { listRoomAnalysesStrict, type RoomAnalysis } from "@/features/ai-upload";
import { getLatestProjectEstimateStrict, type PersistedProjectEstimate } from "@/features/estimate";
import {
  getLatestExportSnapshotStrict,
  type ExportSnapshotHeader,
} from "@/features/export/infrastructure";

export const workflowEvidenceKeys = {
  roomAnalyses: (projectId: string) => ["projects", projectId, "workflow", "roomAnalyses"] as const,
  redesignConcepts: (projectId: string) =>
    ["projects", projectId, "workflow", "redesignConcepts"] as const,
  scopeHeader: (projectId: string) => ["projects", projectId, "workflow", "scopeHeader"] as const,
  projectEstimate: (projectId: string, currentScopeId?: string | null) =>
    ["projects", projectId, "workflow", "projectEstimate", currentScopeId ?? "no-scope"] as const,
  exportSnapshot: (projectId: string) =>
    ["projects", projectId, "workflow", "exportSnapshot"] as const,
};

export function workflowRoomAnalysesQueryOptions(projectId: string) {
  return queryOptions<RoomAnalysis[]>({
    queryKey: workflowEvidenceKeys.roomAnalyses(projectId),
    queryFn: () => listRoomAnalysesStrict(projectId),
    enabled: !!projectId,
  });
}

export function workflowRedesignConceptsQueryOptions(projectId: string) {
  return queryOptions<DurableRedesignConcept[]>({
    queryKey: workflowEvidenceKeys.redesignConcepts(projectId),
    queryFn: () => listRedesignConceptsForClient(projectId),
    enabled: !!projectId,
  });
}

export function workflowScopeHeaderQueryOptions(projectId: string) {
  return queryOptions<ScopeAuthorityHeader | null>({
    queryKey: workflowEvidenceKeys.scopeHeader(projectId),
    queryFn: () => getLatestScopeAuthorityHeaderStrict(projectId),
    enabled: !!projectId,
  });
}

export function workflowProjectEstimateQueryOptions(
  projectId: string,
  currentScopeId?: string | null,
) {
  return queryOptions<PersistedProjectEstimate | null>({
    queryKey: workflowEvidenceKeys.projectEstimate(projectId, currentScopeId),
    queryFn: () => getLatestProjectEstimateStrict(projectId, currentScopeId),
    enabled: !!projectId,
  });
}

export function workflowExportSnapshotQueryOptions(projectId: string) {
  return queryOptions<ExportSnapshotHeader | null>({
    queryKey: workflowEvidenceKeys.exportSnapshot(projectId),
    queryFn: () => getLatestExportSnapshotStrict(projectId),
    enabled: !!projectId,
  });
}
