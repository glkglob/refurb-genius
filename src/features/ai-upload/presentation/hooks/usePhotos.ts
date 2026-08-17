/**
 * AI-upload slice — Photo list read + write hooks (C5-3B2).
 *
 * Reads: photosQueryOptions / fetchProjectPhotosList (React Query sole list cache).
 * Writes: canonical photos-write primitives (uploadProjectPhotos / removeProjectPhoto).
 * Hook-path writes no longer use the legacy in-memory store; BulkPhotoUpload remains deferred to C5-3B3.
 */
import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
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
import { classifyPhotoUploadAnalyticsError } from "../classifyPhotoUploadAnalyticsError";
import { invalidateProjectPhotoQueries } from "./useInvalidateProjectPhotos";
import { photoAnalysisKeys } from "./usePhotoAnalysis";

function invalidateAfterPhotoRemoval(queryClient: QueryClient, projectId: string): void {
  invalidateProjectPhotoQueries(queryClient, projectId);
  void queryClient.invalidateQueries({ queryKey: projectKeys.byId(projectId) });
  void queryClient.invalidateQueries({ queryKey: projectKeys.photoAnalysisByProject(projectId) });
  void queryClient.invalidateQueries({ queryKey: photoAnalysisKeys.byProject(projectId) });
}

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
 *
 * Analytics contract:
 * - full: upload_started → photos_uploaded
 * - partial: upload_started → photos_uploaded → upload_partial_success
 * - failure: upload_started → upload_failed (safe stage/reason only)
 */
export function useUploadPhotos(projectId: string) {
  const queryClient = useQueryClient();

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
        if (error instanceof PhotoUploadBatchError) {
          if (error.successes.length > 0) {
            invalidateProjectPhotoQueries(queryClient, projectId);
            // Canonical success funnel for every persisted photo, including partial batches.
            trackEvent("photos_uploaded", {
              projectId,
              photo_count: error.successes.length,
            });
            trackEvent("upload_partial_success", {
              projectId,
              success_count: error.successes.length,
              failure_count: error.failures.length,
            });
          } else {
            const classified = classifyPhotoUploadAnalyticsError(error, files.length);
            trackEvent("upload_failed", {
              projectId,
              stage: classified.stage,
              reason: classified.reason,
              attempted_count: classified.attempted_count,
              failure_count: classified.failure_count,
              ...(classified.selected_count !== undefined
                ? { selected_count: classified.selected_count }
                : {}),
            });
          }
        } else {
          const classified = classifyPhotoUploadAnalyticsError(error, files.length);
          trackEvent("upload_failed", {
            projectId,
            stage: classified.stage,
            reason: classified.reason,
            attempted_count: classified.attempted_count,
            failure_count: classified.failure_count,
            ...(classified.selected_count !== undefined
              ? { selected_count: classified.selected_count }
              : {}),
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      invalidateProjectPhotoQueries(queryClient, projectId);
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
      const result = await removeProjectPhoto({ photoId, projectId });
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
      invalidateAfterPhotoRemoval(queryClient, projectId);
    },
  });
}
