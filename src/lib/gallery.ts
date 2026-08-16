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
import { resolveSupabaseEnv, supabase } from "@/platform/supabase/browser";
import { logger } from "@/lib/logger";

export const GALLERY_BUCKET = "gallery";
const GALLERY_PUBLIC_PATH_PREFIX = `/storage/v1/object/public/${GALLERY_BUCKET}/`;

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
 * Remove a gallery-bucket object by storage path.
 * Callers that need privacy classification must use revokeGalleryCover.
 */
export async function deleteGalleryStorageObject(path: string): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(GALLERY_BUCKET).remove([path]);
  if (error) {
    logger.error("[gallery] storage delete failed", { path, error: error.message });
    throw new Error(error.message);
  }
}

/**
 * Extract a gallery-bucket object path from a public URL that belongs to the
 * configured Supabase Storage origin.
 * Returns null for empty, malformed, foreign-origin, non-gallery, or traversal paths.
 * Query strings and fragments are ignored.
 */
export function galleryPathFromPublicUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const configured = resolveSupabaseEnv().supabaseUrl?.trim();
  if (!configured) return null;

  let expected: URL;
  try {
    expected = new URL(configured);
  } catch {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username !== "" || parsed.password !== "") return null;
  if (parsed.origin !== expected.origin) return null;
  if (!parsed.pathname.startsWith(GALLERY_PUBLIC_PATH_PREFIX)) return null;

  const raw = parsed.pathname.slice(GALLERY_PUBLIC_PATH_PREFIX.length);
  if (!raw) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }

  if (decoded.includes("\\") || decoded.includes("\0")) return null;

  const parts = decoded.split("/").filter((part) => part.length > 0);
  if (parts.length < 2) return null;
  if (parts.some((part) => part === "." || part === "..")) return null;

  return parts.join("/");
}
