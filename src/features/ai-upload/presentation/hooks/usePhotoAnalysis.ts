/**
 * AI-upload slice — TanStack Query hooks for photo analysis.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RoomAnalysis } from "../../domain";
import {
  getPhotoAnalysis,
  loadPhotoAnalysis,
  runPhotoAnalysis,
  type PhotoAnalysisInput,
} from "../photo-analysis.provider";

export const photoAnalysisKeys = {
  all: ["photo-analysis"] as const,
  byProject: (projectId: string) => [...photoAnalysisKeys.all, projectId] as const,
};

/**
 * Query: load persisted or cached room analyses for a project.
 */
export function useRoomAnalyses(projectId: string | undefined) {
  return useQuery<RoomAnalysis[] | undefined>({
    queryKey: photoAnalysisKeys.byProject(projectId ?? ""),
    queryFn: async () => {
      if (!projectId) return undefined;
      const cached = getPhotoAnalysis(projectId);
      if (cached?.length) return cached;
      return loadPhotoAnalysis(projectId);
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

/**
 * Mutation: run vision analysis for a project's uploaded photos.
 */
export function useRunPhotoAnalysis() {
  const queryClient = useQueryClient();

  return useMutation<RoomAnalysis[], Error, PhotoAnalysisInput>({
    mutationFn: (input) => runPhotoAnalysis(input),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(photoAnalysisKeys.byProject(variables.projectId), data);
    },
  });
}
