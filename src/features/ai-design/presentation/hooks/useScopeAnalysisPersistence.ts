/**
 * AI-design slice — Scope analysis persistence hooks.
 * Moved from `src/hooks/useScopeAnalysisPersistence.ts` (now a shim).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  saveScopeAnalysis,
  getLatestScopeAnalysis,
  type SaveScopeAnalysisInput,
} from "../../infrastructure/repositories/scope-analysis.repository";

export function useSavedScopeAnalysis(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["scope-analysis", projectId],
    queryFn: () => getLatestScopeAnalysis(projectId),
    enabled: !!user && !!projectId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveScopeAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveScopeAnalysisInput) => saveScopeAnalysis(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["scope-analysis", variables.projectId],
      });
    },
  });
}
