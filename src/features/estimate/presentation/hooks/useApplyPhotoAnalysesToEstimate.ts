/**
 * Presentation-safe Apply-to-Estimate client cache ownership (AO-1C2).
 *
 * Owns QueryClient setQueryData + invalidateQueries on estimateQueryOptions.
 * Mapping is pure (mapPhotoAnalysesToEstimateRooms). No toast, selection, or DB write.
 */
import { useQueryClient } from "@tanstack/react-query";
import { estimateQueryOptions } from "@/lib/queries/projects";
import type { PhotoAnalysisResultRow } from "@/lib/queries/photo-analysis";
import type { PersistedRoomEstimate } from "../../infrastructure/repositories/estimate.repository";
import { mapPhotoAnalysesToEstimateRooms } from "../../application/mapPhotoAnalysesToEstimateRooms";

export interface ApplyPhotoAnalysesToEstimateResult {
  analysisCount: number;
  roomCount: number;
}

/**
 * Apply photo analyses into the project estimate React Query cache (append rooms).
 */
export function useApplyPhotoAnalysesToEstimate(projectId: string): {
  applyPhotoAnalysesToEstimate(
    analyses: PhotoAnalysisResultRow[],
  ): ApplyPhotoAnalysesToEstimateResult;
} {
  const queryClient = useQueryClient();

  return {
    applyPhotoAnalysesToEstimate(analyses: PhotoAnalysisResultRow[]) {
      const estimateKey = estimateQueryOptions(projectId).queryKey;
      const current = queryClient.getQueryData<PersistedRoomEstimate | null>(estimateKey);

      const newRooms = mapPhotoAnalysesToEstimateRooms(analyses);
      const existingRooms = current?.rooms || [];
      const mergedRooms = [...existingRooms, ...newRooms];

      if (current) {
        queryClient.setQueryData(estimateKey, { ...current, rooms: mergedRooms } as never);
      } else {
        queryClient.setQueryData(estimateKey, { rooms: mergedRooms } as never);
      }

      void queryClient.invalidateQueries({ queryKey: estimateKey });

      return {
        analysisCount: analyses.length,
        roomCount: newRooms.length,
      };
    },
  };
}
