/**
 * React Query presentation layer for ephemeral project-photo signed URLs.
 *
 * Cached signed URLs are reused until they enter the pre-expiry refresh
 * margin. Window focus may check expiry; it does not remint merely because
 * 60 seconds have elapsed.
 */
import { queryOptions, useQueries, useQuery, type QueryClient } from "@tanstack/react-query";
import { getPhotoStorageClient } from "@/lib/photos-write";
import { projectKeys } from "@/lib/queries/projects";
import {
  createProjectPhotoSignedUrl,
  PROJECT_PHOTO_DISPLAY_GC_TIME_MS,
  SIGNED_URL_STALE_TIME_MS,
  SIGNED_URL_TTL_SECONDS,
  type ProjectPhotoSignedUrl,
} from "../projectPhotoDisplay";

export type ProjectPhotoDisplayQueryInput = {
  projectId: string;
  photoId: string;
  storagePath: string;
};

export function projectPhotoDisplayQueryOptions(input: ProjectPhotoDisplayQueryInput) {
  const enabled = Boolean(input.projectId && input.photoId && input.storagePath);
  return queryOptions<ProjectPhotoSignedUrl>({
    queryKey: projectKeys.photoDisplay(input.projectId, input.photoId),
    queryFn: async () => {
      const client = await getPhotoStorageClient();
      return createProjectPhotoSignedUrl(client, input.storagePath, SIGNED_URL_TTL_SECONDS);
    },
    enabled,
    staleTime: SIGNED_URL_STALE_TIME_MS,
    gcTime: PROJECT_PHOTO_DISPLAY_GC_TIME_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useProjectPhotoDisplayUrl(input: ProjectPhotoDisplayQueryInput) {
  return useQuery(projectPhotoDisplayQueryOptions(input));
}

export function useProjectPhotoDisplayUrls(
  projectId: string,
  photos: Array<{ id: string; storagePath: string }>,
) {
  const queries = useQueries({
    queries: photos.map((photo) =>
      projectPhotoDisplayQueryOptions({
        projectId,
        photoId: photo.id,
        storagePath: photo.storagePath,
      }),
    ),
  });

  const urlByPhotoId = new Map<string, string>();
  photos.forEach((photo, index) => {
    const signedUrl = queries[index]?.data?.signedUrl;
    if (signedUrl) urlByPhotoId.set(photo.id, signedUrl);
  });

  return { queries, urlByPhotoId };
}

/**
 * One controlled display-cache invalidation after an image load failure.
 * `retried.current` bounds the retry to a single remint.
 */
export function retryProjectPhotoDisplayOnce(
  queryClient: QueryClient,
  projectId: string,
  photoId: string,
  retried: { current: boolean },
): void {
  if (retried.current || !projectId || !photoId) return;
  retried.current = true;
  void queryClient.invalidateQueries({
    queryKey: projectKeys.photoDisplay(projectId, photoId),
  });
}
