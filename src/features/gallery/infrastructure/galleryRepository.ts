/**
 * Gallery publication persistence (AO-1M3).
 *
 * Browser Supabase upsert into public_gallery_projects.
 * Conflict identity: project_id (unique). Ownership enforced by RLS.
 */
import { supabase } from "@/platform/supabase/browser";
import { logger } from "@/lib/logger";
import type { PublicGalleryProjectRow } from "@/lib/queries/gallery";

export interface UpsertGalleryProjectRecordInput {
  projectId: string;
  userId: string;
  is_public?: boolean;
  featured?: boolean;
  title?: string | null;
  description?: string | null;
  cover_image_url?: string | null;
}

/**
 * Upsert a public_gallery_projects row for the project owner.
 * Preserves pre-extraction payload, conflict target, and error behaviour.
 */
export async function upsertGalleryProject(
  input: UpsertGalleryProjectRecordInput,
): Promise<PublicGalleryProjectRow> {
  const { projectId, userId, ...fields } = input;

  const { data, error } = await supabase
    .from("public_gallery_projects")
    .upsert(
      {
        project_id: projectId,
        created_by: userId,
        slug: projectId,
        ...fields,
        title: fields.title ?? "Untitled Project",
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
}

export const galleryRepository = {
  upsertGalleryProject,
};
