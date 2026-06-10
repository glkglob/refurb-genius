// Storage helpers for the public Gallery feature.
//
// Mirrors the pattern established in `src/lib/floorplan.ts`, but the
// `gallery` bucket is PUBLIC (unlike `floorplans`), so uploads return a
// public URL directly via `getPublicUrl()` rather than a signed URL.
//
// RLS on the `gallery` bucket requires the object path to start with
// `{auth.uid()}/...` for INSERT/DELETE (see
// supabase/migrations/20260605123000_feature_foundation.sql), so callers
// must always pass the current user's id as `userId`.
import { supabase } from "@/platform/supabase/browser";
import { logger } from "@/lib/logger";

export const GALLERY_BUCKET = "gallery";

/**
 * Upload a cover image for a project's public gallery listing.
 * Returns the storage path and a public URL suitable for `cover_image_url`.
 */
export async function uploadGalleryCoverImage(
  projectId: string,
  file: File,
  userId: string,
): Promise<{ path: string; publicUrl: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeName = file.name.replace(/[^a-z0-9.-]/gi, "_");
  const id = crypto.randomUUID();
  const path = `${userId}/${projectId}/${id}-${safeName}`;

  const { error: uploadErr } = await supabase.storage.from(GALLERY_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || (ext === "png" ? "image/png" : "image/jpeg"),
  });

  if (uploadErr) {
    logger.error("[gallery] cover image upload failed", { path, error: uploadErr.message });
    throw uploadErr;
  }

  const { data } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

/**
 * Best-effort removal of a previously uploaded cover image.
 * Non-fatal: storage cleanup failures shouldn't block DB updates.
 */
export async function deleteGalleryStorageObject(path: string): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(GALLERY_BUCKET).remove([path]);
  if (error) {
    logger.warn("[gallery] storage delete warning (non-fatal)", { path, error: error.message });
  }
}

/**
 * Extract the storage path from a public gallery URL, e.g. for cleanup
 * before uploading a replacement. Returns null if the URL doesn't look
 * like a `gallery` bucket public URL.
 */
export function galleryPathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/object/public/${GALLERY_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}
