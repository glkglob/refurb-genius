/**
 * Gallery publication persistence (AO-1M3 / P1B4 / SEC-1B-GALLERY-B).
 *
 * Browser Supabase upsert into public_gallery_projects.
 * Conflict identity: project_id (unique). Ownership enforced by RLS via project.
 *
 * Public gallery record = listing metadata + optional cover_image_url.
 * This module must not join or retrieve project photos, must not read
 * photos.url / photos.storage_path, and must not sign private objects.
 *
 * Canonical columns (migration 20260605123000):
 *   project_id, is_public, featured, title, description, cover_image_url,
 *   view_count, created_at, updated_at
 *
 * Obsolete (not written): created_by, slug, is_published, summary, location, …
 * Public routes use gallery row `id` as the URL param (not a slug column).
 */
import type { PublicGalleryPublication } from "@/features/gallery/domain";
import { logger } from "@/lib/logger";
import { mapPublicGalleryProjectRow, type PublicGalleryProjectRow } from "@/lib/queries/gallery";
import { supabase } from "@/platform/supabase/browser";

export interface UpsertGalleryProjectRecordInput {
  projectId: string;
  /** Authenticated owner; used for auth gate only — not a table column. */
  userId: string;
  is_public?: boolean;
  featured?: boolean;
  title?: string | null;
  description?: string | null;
  cover_image_url?: string | null;
}

/** Canonical upsert payload for public_gallery_projects. */
type CanonicalGalleryUpsert = {
  project_id: string;
  is_public?: boolean;
  featured?: boolean;
  title: string;
  description?: string | null;
  cover_image_url?: string | null;
};

type WriteError = { message: string } | null;

/**
 * Minimal dual-baseline write surface (from → upsert → select → single).
 * Avoids TablesInsert drift between tracked historical and canonical shapes.
 */
type GalleryWriteClient = {
  from(table: string): {
    upsert(
      values: object,
      options?: { onConflict?: string },
    ): {
      select(columns?: string): {
        single(): PromiseLike<{ data: unknown; error: WriteError }>;
      };
    };
  };
};

function galleryWriteClient(): GalleryWriteClient {
  return supabase;
}

/**
 * Upsert a public_gallery_projects row for the project owner.
 * Canonical payload only; ownership is RLS via project_id.
 */
export async function upsertGalleryProject(
  input: UpsertGalleryProjectRecordInput,
): Promise<PublicGalleryProjectRow> {
  const { projectId, userId: _userId, ...fields } = input;

  const row: CanonicalGalleryUpsert = {
    project_id: projectId,
    title: fields.title ?? "Untitled Project",
  };
  if (fields.is_public !== undefined) row.is_public = fields.is_public;
  if (fields.featured !== undefined) row.featured = fields.featured;
  if (fields.description !== undefined) row.description = fields.description;
  if (fields.cover_image_url !== undefined) row.cover_image_url = fields.cover_image_url;

  const { data, error } = await galleryWriteClient()
    .from("public_gallery_projects")
    .upsert(row, { onConflict: "project_id" })
    .select("*")
    .single();

  if (error) {
    logger.error("[gallery] upsert failed", { projectId, error: error.message });
    throw new Error(error.message);
  }

  return mapPublicGalleryProjectRow(data);
}

export const galleryRepository = {
  upsertGalleryProject,
};

/**
 * Map a listing row to the public publication contract.
 * Imagery is coverImageUrl only — no project-photo fields.
 */
export function toPublicGalleryPublication(row: PublicGalleryProjectRow): PublicGalleryPublication {
  return {
    id: row.id,
    projectId: row.project_id,
    isPublic: row.is_public,
    featured: row.featured,
    title: row.title,
    description: row.description,
    coverImageUrl: row.cover_image_url,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
