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
  type PhotoUploadItemEvent,
} from "@/lib/photos-write";
import { photosQueryOptions, projectKeys } from "@/lib/queries/projects";
import { logger } from "@/lib/logger";
import { trackEvent } from "@/lib/analytics";

export function usePhotos(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    ...photosQueryOptions(projectId),
    enabled: !!user && !!projectId,
  });
}

export type UploadPhotosVariables = {
  files: File[];
  onItemState?: (event: PhotoUploadItemEvent) => void;
  concurrency?: number;
};

/**
 * Upload one or more project photos via the canonical batch primitive.
 * Accepts File[] or { files, onItemState, concurrency } for per-file progress.
 * Full success returns ProjectPhoto[].
 * Partial batch success invalidates the project-photo list then rethrows PhotoUploadBatchError.
 */
export function useUploadPhotos(projectId: string) {
  const queryClient = useQueryClient();
  const photosKey = projectKeys.photosByProject(projectId);

  return useMutation({
    mutationFn: async (input: File[] | UploadPhotosVariables): Promise<ProjectPhoto[]> => {
      const files = Array.isArray(input) ? input : input.files;
      const onItemState = Array.isArray(input) ? undefined : input.onItemState;
      const concurrency = Array.isArray(input) ? undefined : input.concurrency;

      trackEvent("upload_started", {
        projectId,
        file_count: files.length,
        total_bytes: files.reduce((s, f) => s + f.size, 0),
      });

      try {
        const photos = await uploadProjectPhotos({
          projectId,
          files,
          ...(onItemState ? { onItemState } : {}),
          ...(concurrency !== undefined ? { concurrency } : {}),
        });
        trackEvent("photos_uploaded", {
          projectId,
          photo_count: photos.length,
        });
        return photos;
      } catch (error) {
        // Persist partial successes into the product list cache authority.
        if (error instanceof PhotoUploadBatchError) {
          if (error.successes.length > 0) {
            void queryClient.invalidateQueries({ queryKey: photosKey });
            trackEvent("upload_partial_success", {
              projectId,
              success_count: error.successes.length,
              failure_count: error.failures.length,
            });
          } else {
            trackEvent("upload_failed", {
              projectId,
              failure_count: error.failures.length,
              stages: error.failures.map((f) => f.stage).join(","),
            });
          }
        } else {
          trackEvent("upload_failed", {
            projectId,
            failure_count: files.length,
            error: error instanceof Error ? error.message : "unknown",
          });
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
