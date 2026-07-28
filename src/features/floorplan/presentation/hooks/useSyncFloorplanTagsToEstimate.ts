/**
 * Presentation-safe Floorplan → product-estimate tag sync (AO-1H2).
 *
 * Owns:
 * - useQueryClient
 * - product estimate key (estimateQueryOptions / projectKeys.estimateByProject)
 * - getQueryData / setQueryData / void invalidateQueries
 * - annotation-label → placeholder room mapping (pure mapper)
 * - info + success toasts
 *
 * Cache-only: no estimate DB persistence, AI parallel estimate keys, financials,
 * TanStack mutation objects, pending state, Auth, or Supabase.
 *
 * Does not own estimate or annotation read queries (remain in FloorplanViewer).
 */
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { estimateQueryOptions } from "@/lib/queries/projects";
import {
  extractFloorplanAnnotationLabels,
  mapFloorplanAnnotationsToEstimateRooms,
} from "../../application/mapFloorplanAnnotationsToEstimateRooms";

export type UseSyncFloorplanTagsToEstimateResult = {
  syncTagsToEstimate(annotations: ReadonlyArray<{ label?: unknown }>): void;
};

export function useSyncFloorplanTagsToEstimate(
  projectId: string,
): UseSyncFloorplanTagsToEstimateResult {
  const queryClient = useQueryClient();

  return {
    syncTagsToEstimate(annotations) {
      if (!annotations.length) return;

      // Label uniqueness before cache access (matches prior silent early-return order).
      const uniqueLabels = extractFloorplanAnnotationLabels(annotations);
      if (!uniqueLabels.length) return;

      const estimateKey = estimateQueryOptions(projectId).queryKey;
      const current = queryClient.getQueryData<{
        rooms?: Array<{ name?: string }>;
        [key: string]: unknown;
      }>(estimateKey);

      const { newRooms } = mapFloorplanAnnotationsToEstimateRooms(
        annotations,
        current?.rooms || [],
      );

      if (!newRooms.length) {
        toast.info("All tags already in Estimate");
        return;
      }

      const mergedRooms = [...(current?.rooms || []), ...newRooms];
      queryClient.setQueryData(
        estimateKey,
        // mergedRooms are optimistic placeholders; full shape may be populated on invalidation
        (current ? { ...current, rooms: mergedRooms } : { rooms: mergedRooms }) as never,
      );
      void queryClient.invalidateQueries({ queryKey: estimateKey });
      toast.success(`Synced ${newRooms.length} room tags from 3D to Estimate Builder`);
    },
  };
}
