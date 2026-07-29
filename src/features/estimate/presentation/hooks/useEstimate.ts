/**
 * Estimate slice — TanStack Query hooks.
 * Moved from `src/hooks/useAIEstimate.ts` (now a shim).
 *
 * AO-1K1: product estimate cache authority is projectKeys.estimateByProject /
 * estimateQueryOptions (["projects", projectId, "estimate"]).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { estimateQueryOptions, projectKeys } from "@/lib/queries/projects";
import { generateEstimateServerFn } from "../serverFns";
import type { GenerateEstimateInput, AIGeneratedRoom } from "../../domain";
import {
  saveAIEstimate,
  type SaveAIEstimateInput,
  type PersistedRoomEstimate,
} from "../../infrastructure/repositories/estimate.repository";

/**
 * Mutation: call the server function to generate an AI estimate.
 * Returns an array of AIGeneratedRoom[] on success.
 */
export function useGenerateEstimate() {
  return useMutation<AIGeneratedRoom[], Error, GenerateEstimateInput>({
    mutationFn: (input) => generateEstimateServerFn({ data: input }),
  });
}

/**
 * Mutation: persist the finalised AI estimate (rooms + items) to Supabase.
 * On success invalidates the product estimate key and project financials
 * (fire-and-forget, success-only) so product readers and ROI stay coherent.
 */
export function useSaveAIEstimate() {
  const queryClient = useQueryClient();

  return useMutation<PersistedRoomEstimate, Error, SaveAIEstimateInput>({
    mutationFn: saveAIEstimate,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: projectKeys.estimateByProject(variables.projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: projectKeys.financialsByProject(variables.projectId),
      });
    },
  });
}

/**
 * Query: load the latest AI-generated (room-based) estimate for a project.
 * Uses the canonical product estimate query options.
 */
export function useRoomEstimate(projectId: string | undefined) {
  return useQuery({
    ...estimateQueryOptions(projectId ?? ""),
    enabled: !!projectId,
  });
}
