import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";
import { logger } from "@/lib/logger";
import { galleryKeys, type PublicGalleryProjectRow } from "@/lib/queries/gallery";

export interface UpsertGalleryProjectInput {
  is_public?: boolean;
  featured?: boolean;
  title?: string | null;
  description?: string | null;
  cover_image_url?: string | null;
}

/**
 * Owner-management mutation for the "Publish to Gallery" feature.
 *
 * Upserts a row into `public_gallery_projects` keyed on `project_id`
 * (unique). RLS (`public_gallery_projects_owner_manage`) permits this for
 * the project owner only.
 *
 * Includes an optimistic update against `galleryKeys.byProject(projectId)`
 * so toggles (is_public / featured) feel instant, with rollback on error
 * and a final invalidation to reconcile with the server (view_count, id,
 * timestamps, etc.).
 */
export function useUpsertGalleryProject(projectId: string) {
  const queryClient = useQueryClient();
  const queryKey = galleryKeys.byProject(projectId);

  return useMutation({
    mutationFn: async (input: UpsertGalleryProjectInput) => {
      const { data, error } = await supabase
        .from("public_gallery_projects")
        .upsert(
          {
            project_id: projectId,
            ...input,
          },
          { onConflict: "project_id" },
        )
        .select("*")
        .single();

      if (error) {
        logger.error("[gallery] upsert failed", { projectId, error: error.message });
        throw new Error(error.message);
      }
      return data as PublicGalleryProjectRow;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PublicGalleryProjectRow | null>(queryKey);

      const now = new Date().toISOString();
      const fallback: PublicGalleryProjectRow = {
        id: previous?.id ?? "",
        project_id: projectId,
        is_public: false,
        featured: false,
        title: null,
        description: null,
        cover_image_url: null,
        view_count: 0,
        created_at: previous?.created_at ?? now,
        updated_at: now,
      };

      queryClient.setQueryData<PublicGalleryProjectRow | null>(queryKey, {
        ...(previous ?? fallback),
        ...input,
        project_id: projectId,
        updated_at: now,
      });

      return { previous };
    },
    onError: (err, _input, context) => {
      if (context && "previous" in context) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      logger.error("[gallery] upsert mutation error", {
        projectId,
        error: err instanceof Error ? err.message : String(err),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
