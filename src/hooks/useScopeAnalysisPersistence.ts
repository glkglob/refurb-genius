import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import {
  saveScopeAnalysis,
  getLatestScopeAnalysis,
  type SaveScopeAnalysisInput,
} from "@/lib/scopeAnalysis";

export function useSavedScopeAnalysis(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["scope-analysis", projectId],
    queryFn: () => getLatestScopeAnalysis(projectId),
    enabled: !!user && !!projectId,
    staleTime: 1000 * 60 * 5, // 5 min — scope results don't change behind the user's back
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
