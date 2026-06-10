/**
 * AI-upload slice — Photo upload hooks.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { photoStore, type ProjectPhoto } from "@/lib/photos";
import { photosQueryOptions, projectKeys } from "@/lib/queries/projects";

export function usePhotos(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    ...photosQueryOptions(projectId),
    enabled: !!user && !!projectId,
  });
}

export function useUploadPhotos(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => photoStore.upload(projectId, files),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: projectKeys.photosByProject(projectId),
      });
    },
  });
}

export function useRemovePhoto(projectId: string) {
  const queryClient = useQueryClient();
  const photosKey = projectKeys.photosByProject(projectId);

  return useMutation({
    mutationFn: (photoId: string) => photoStore.remove(projectId, photoId),
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
