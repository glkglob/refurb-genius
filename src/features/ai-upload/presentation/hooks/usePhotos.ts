/**
 * AI-upload slice — Photo list read + write hooks (C5-3B2).
 *
 * Reads: photosQueryOptions / fetchProjectPhotosList (React Query sole list cache).
 * Writes: canonical photos-write primitives (uploadProjectPhotos / removeProjectPhoto).
 * Hook-path writes no longer use the legacy in-memory store; BulkPhotoUpload remains deferred to C5-3B3.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import type { ProjectPhoto } from "@/lib/photos-types";
import {
  uploadProjectPhotos,
  removeProjectPhoto,
  PhotoUploadBatchError,
  type PhotoRemovalResult,
} from "@/lib/photos-write";
import { photosQueryOptions, projectKeys } from "@/lib/queries/projects";
import { logger } from "@/lib/logger";

export function usePhotos(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    ...photosQueryOptions(projectId),
    enabled: !!user && !!projectId,
  });
}

/**
 * Upload one or more project photos via the canonical batch primitive.
 * Input remains File[]; full success returns ProjectPhoto[].
 * Partial batch success invalidates the project-photo list then rethrows PhotoUploadBatchError.
 */
export function useUploadPhotos(projectId: string) {
  const queryClient = useQueryClient();
  const photosKey = projectKeys.photosByProject(projectId);

  return useMutation({
    mutationFn: async (files: File[]): Promise<ProjectPhoto[]> => {
      try {
        return await uploadProjectPhotos({ projectId, files });
      } catch (error) {
        // Persist partial successes into the product list cache authority.
        if (error instanceof PhotoUploadBatchError && error.successes.length > 0) {
          void queryClient.invalidateQueries({ queryKey: photosKey });
        }
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: photosKey });
    },
  });
}

/**
 * Remove a project photo by id via the canonical remove primitive.
 * Optimistic list update; all PhotoRemovalResult cleanup statuses are mutation success.
 */
export function useRemovePhoto(projectId: string) {
  const queryClient = useQueryClient();
  const photosKey = projectKeys.photosByProject(projectId);

  return useMutation({
    mutationFn: async (photoId: string): Promise<PhotoRemovalResult> => {
      const result = await removeProjectPhoto({ photoId });
      if (result.storageCleanup === "orphan-warning") {
        logger.warn("[photos] storage orphan after metadata delete", {
          photoId: result.photoId,
          storageCleanup: result.storageCleanup,
          storageError:
            result.storageError instanceof Error
              ? result.storageError.message
              : result.storageError != null
                ? String(result.storageError)
                : undefined,
        });
      }
      return result;
    },
    onMutate: async (photoId) => {
      await queryClient.cancelQueries({ queryKey: photosKey });
      const previous = queryClient.getQueryData<ProjectPhoto[]>(photosKey);
      queryClient.setQueryData<ProjectPhoto[]>(photosKey, (old) =>
        old?.filter((p) => p.id !== photoId),
      );
      return { previous };
    },
    onError: (_err, _photoId, context) => {
      if (context?.previous) queryClient.setQueryData(photosKey, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: photosKey });
    },
  });
}
