import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { supabase } from "@/services/supabase";
import { photoStore, type ProjectPhoto } from "@/lib/photos";
import { rowToPhoto } from "@/lib/mappers";

async function fetchPhotos(projectId: string): Promise<ProjectPhoto[]> {
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToPhoto);
}

export function usePhotos(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["photos", projectId],
    queryFn: () => fetchPhotos(projectId),
    enabled: !!user && !!projectId,
  });
}

export function useUploadPhotos(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => photoStore.upload(projectId, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photos", projectId] });
    },
  });
}

export function useRemovePhoto(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => photoStore.remove(projectId, photoId),
    onMutate: async (photoId) => {
      await queryClient.cancelQueries({ queryKey: ["photos", projectId] });
      const previous = queryClient.getQueryData<ProjectPhoto[]>(["photos", projectId]);
      queryClient.setQueryData<ProjectPhoto[]>(["photos", projectId], (old) =>
        old?.filter((p) => p.id !== photoId),
      );
      return { previous };
    },
    onError: (_err, _photoId, context) => {
      if (context?.previous) queryClient.setQueryData(["photos", projectId], context.previous);
    },
  });
}
