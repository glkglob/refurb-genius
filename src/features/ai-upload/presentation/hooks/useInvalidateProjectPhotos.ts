/**
 * Presentation-safe project-photo list invalidation (AO-1I1).
 *
 * Owns:
 * - useQueryClient
 * - projectKeys.photosByProject(projectId) → ["projects", projectId, "photos"]
 * - void invalidateQueries (fire-and-forget)
 *
 * Does not own upload primitives, Storage/DB writes, toasts, progress UI,
 * useMutation, setQueryData/getQueryData, or pending state.
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { projectKeys } from "@/lib/queries/projects";

/**
 * Returns a synchronous callback that fire-and-forgets invalidation of the
 * canonical product project-photo list for `projectId`.
 *
 * Rejection of the invalidation promise must not throw to the caller (void).
 */
export function useInvalidateProjectPhotos(projectId: string): () => void {
  const queryClient = useQueryClient();

  return useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: projectKeys.photosByProject(projectId),
    });
  }, [projectId, queryClient]);
}
