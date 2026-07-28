/**
 * Presentation-safe EstimateBuilder manual-save ownership (AO-1G1).
 *
 * Owns:
 * - useMutation + useQueryClient
 * - one-shot product estimate cache seed read
 * - optimistic write / rollback on estimateQueryOptions key
 * - success invalidations (estimate + financials)
 * - draft localStorage clear
 * - save success/error toasts
 * - onSaved orchestration
 *
 * Persistence: saveAIEstimate (unchanged). Product estimate key only
 * (does not touch the parallel AI hook key family).
 * Does not own editor calculations, PDF, or room CRUD.
 */
import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { estimateQueryOptions, projectKeys } from "@/lib/queries/projects";
import {
  saveAIEstimate,
  type PersistedRoomEstimate,
  type SaveAIEstimateInput,
} from "../../infrastructure/repositories/estimate.repository";

/** Editor room shape used for optimistic cache (preserves item ids via spread). */
export type EstimateBuilderOptimisticItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  notes?: string;
};

export type EstimateBuilderOptimisticRoom = {
  id: string;
  name: string;
  area_sqm?: number;
  items: EstimateBuilderOptimisticItem[];
};

export type SaveEstimateBuilderVariables = {
  input: SaveAIEstimateInput;
  optimistic: {
    total: number;
    rooms: EstimateBuilderOptimisticRoom[];
  };
};

export type UseSaveEstimateBuilderOptions = {
  onSaved?: () => void;
};

export type UseSaveEstimateBuilderResult = {
  save: (variables: SaveEstimateBuilderVariables) => void;
  isPending: boolean;
  /** One-shot product estimate cache read (no subscription). */
  getSeededEstimate: () => PersistedRoomEstimate | null | undefined;
};

export function useSaveEstimateBuilder(
  projectId: string,
  options?: UseSaveEstimateBuilderOptions,
): UseSaveEstimateBuilderResult {
  const queryClient = useQueryClient();
  const onSaved = options?.onSaved;

  const getSeededEstimate = useCallback((): PersistedRoomEstimate | null | undefined => {
    return queryClient.getQueryData<PersistedRoomEstimate | null>(
      estimateQueryOptions(projectId).queryKey,
    );
  }, [queryClient, projectId]);

  const mutation = useMutation({
    mutationFn: (variables: SaveEstimateBuilderVariables) => saveAIEstimate(variables.input),
    onMutate: async (variables) => {
      const estimateKey = estimateQueryOptions(projectId).queryKey;
      await queryClient.cancelQueries({ queryKey: estimateKey });
      const previous = queryClient.getQueryData(estimateKey);
      queryClient.setQueryData(estimateKey, {
        estimate: { mid_total: variables.optimistic.total },
        rooms: variables.optimistic.rooms.map((r) => ({
          name: r.name,
          area_sqm: r.area_sqm,
          items: r.items.map((i) => ({ ...i, base_unit_cost: i.unit_cost })),
        })),
      } as unknown as PersistedRoomEstimate | null);
      return { previous };
    },
    onError: (_e, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(estimateQueryOptions(projectId).queryKey, context.previous);
      }
      toast.error("Save failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.estimateByProject(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.financialsByProject(projectId) });
      localStorage.removeItem(`estimate-draft:${projectId}`);
      toast.success("Estimate saved");
      onSaved?.();
    },
  });

  return {
    save: (variables: SaveEstimateBuilderVariables) => {
      mutation.mutate(variables);
    },
    isPending: mutation.isPending,
    getSeededEstimate,
  };
}
