/**
 * Estimate slice — TanStack Query hooks.
 * Moved from `src/hooks/useAIEstimate.ts` (now a shim).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { generateEstimateServerFn } from "../serverFns";
import type {
  GenerateEstimateInput,
  AIGeneratedRoom,
} from "../../infrastructure/adapters/ai-estimate.adapter.server";
import {
  saveAIEstimate,
  getLatestRoomEstimate,
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
 * Invalidates the room-estimate query on success so the UI picks up the saved state.
 */
export function useSaveAIEstimate() {
  const queryClient = useQueryClient();

  return useMutation<PersistedRoomEstimate, Error, SaveAIEstimateInput>({
    mutationFn: saveAIEstimate,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["room-estimate", variables.projectId],
      });
    },
  });
}

/**
 * Query: load the latest AI-generated (room-based) estimate for a project.
 */
export function useRoomEstimate(projectId: string | undefined) {
  return useQuery<PersistedRoomEstimate | null>({
    queryKey: ["room-estimate", projectId],
    queryFn: () => (projectId ? getLatestRoomEstimate(projectId) : null),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}
