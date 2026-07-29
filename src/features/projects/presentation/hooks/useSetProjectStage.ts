/**
 * Presentation-safe project stage mutation (AO-1M4).
 *
 * Owns:
 * - useMutation lifecycle
 * - exact list + detail query cancellation
 * - dual-cache optimistic update via query helpers
 * - rollback via query helpers
 * - pending state
 *
 * Persistence: projectStageRepository.setProjectStageDone (infrastructure).
 * No auth gate, invalidation, toast, logging, or navigation.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProjectStage } from "@/core/projects/domain";
import {
  projectKeys,
  projectStagePatch,
  applyProjectStageOptimistic,
  restoreProjectStageCaches,
} from "@/lib/queries/projects";
import { projectStageRepository } from "../../infrastructure/projectStageRepository";

export interface SetProjectStageVariables {
  id: string;
  stage: ProjectStage;
  value: boolean;
}

/**
 * Stage progress mutation (C4c-3 dual-cache optimistic sync).
 *
 * Dual-cache optimistic sync: projectKeys.all + projectKeys.byId(id) when detail
 * is already a cached Project. Cancels only exact list/detail keys (not nested).
 * Overlapping stage mutations may still race on rollback (accepted; same class as
 * pre-C4c-3 list-only optimism).
 */
export function useSetProjectStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage, value }: SetProjectStageVariables) => {
      return projectStageRepository.setProjectStageDone({
        projectId: id,
        stage,
        value,
      });
    },
    onMutate: async ({ id, stage, value }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: projectKeys.all, exact: true }),
        queryClient.cancelQueries({ queryKey: projectKeys.byId(id), exact: true }),
      ]);
      const snapshot = applyProjectStageOptimistic(
        queryClient,
        id,
        projectStagePatch(stage, value),
      );
      return { ...snapshot, id };
    },
    onError: (_err, _vars, context) => {
      if (!context) return;
      restoreProjectStageCaches(queryClient, context.id, {
        previousList: context.previousList,
        previousDetail: context.previousDetail,
      });
    },
  });
}
