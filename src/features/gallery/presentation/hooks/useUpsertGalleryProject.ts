/**
 * Presentation-safe gallery upsert mutation (AO-1M3).
 *
 * Owns:
 * - auth.getUser gate
 * - useMutation lifecycle
 * - optimistic cache + rollback against galleryKeys.byProject
 * - settled invalidation (canonical by-project key only)
 * - mutation logging
 *
 * Persistence: galleryRepository.upsertGalleryProject (infrastructure).
 * Toasts remain component-owned (PublishToGallery mutate callbacks).
 * Cover upload and gallery reads remain outside this hook.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { galleryKeys, type PublicGalleryProjectRow } from "@/lib/queries/gallery";
import { galleryRepository } from "../../infrastructure/galleryRepository";

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
      const user = auth.getUser();
      if (!user) throw new Error("You must be signed in");
      return galleryRepository.upsertGalleryProject({
        projectId,
        userId: user.id,
        ...input,
      });
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PublicGalleryProjectRow | null>(queryKey);

      const now = new Date().toISOString();
      const user = auth.getUser();
      const fallback: PublicGalleryProjectRow = {
        id: previous?.id ?? "",
        project_id: projectId,
        created_by: user?.id ?? "",
        slug: previous?.slug ?? projectId,
        is_public: false,
        is_published: false,
        featured: false,
        title: previous?.title ?? "Untitled Project",
        description: null,
        summary: null,
        cover_image_url: null,
        location: null,
        style: null,
        budget: null,
        roi: null,
        published_at: null,
        view_count: 0,
        created_at: previous?.created_at ?? now,
        updated_at: now,
      };

      const merged = {
        ...(previous ?? fallback),
        ...input,
        title: input.title ?? previous?.title ?? fallback.title,
        project_id: projectId,
        updated_at: now,
      };
      queryClient.setQueryData<PublicGalleryProjectRow | null>(queryKey, merged);

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
