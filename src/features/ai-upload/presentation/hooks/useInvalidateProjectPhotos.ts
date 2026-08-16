/**
 * Presentation-safe project-photo list + display invalidation (AO-1I1 / R1C).
 *
 * Owns:
 * - useQueryClient
 * - projectKeys.photosByProject(projectId) → ["projects", projectId, "photos"]
 * - projectKeys.photoDisplayByProject(projectId) → ["projects", projectId, "photoDisplay"]
 * - void invalidateQueries (fire-and-forget)
 *
 * Does not own upload primitives, writes, toasts, progress UI,
 * useMutation, setQueryData/getQueryData, or pending state.
 */
import { useCallback } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { projectKeys } from "@/lib/queries/projects";

/** Invalidate durable photo metadata and derived display URLs for a project. */
export function invalidateProjectPhotoQueries(queryClient: QueryClient, projectId: string): void {
  void queryClient.invalidateQueries({
    queryKey: projectKeys.photosByProject(projectId),
  });
  void queryClient.invalidateQueries({
    queryKey: projectKeys.photoDisplayByProject(projectId),
  });
}

/**
 * Returns a synchronous callback that fire-and-forgets invalidation of the
 * canonical product project-photo list and display cache for `projectId`.
 *
 * Rejection of the invalidation promise must not throw to the caller (void).
 */
export function useInvalidateProjectPhotos(projectId: string): () => void {
  const queryClient = useQueryClient();

  return useCallback(() => {
    invalidateProjectPhotoQueries(queryClient, projectId);
  }, [projectId, queryClient]);
}
