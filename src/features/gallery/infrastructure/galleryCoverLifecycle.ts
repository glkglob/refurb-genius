/**
 * Owner-authorised gallery cover revocation (SEC-1B-GALLERY-C).
 *
 * Uses the browser Supabase JWT and the public `gallery` bucket only.
 * Does not sign objects or access any other storage bucket.
 */
import type { GalleryCoverLifecycle } from "@/features/gallery/application";
import type { GalleryCoverRevocationResult } from "@/features/gallery/domain";
import { GALLERY_BUCKET, galleryPathFromPublicUrl } from "@/lib/gallery";
import { logger } from "@/lib/logger";
import { supabase } from "@/platform/supabase/browser";

function revokeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "Gallery cover revoke failed";
}

export async function revokeGalleryCover(input: {
  coverImageUrl: string | null;
}): Promise<GalleryCoverRevocationResult> {
  const url = input.coverImageUrl?.trim() ?? "";
  if (!url) return { status: "already_absent" };

  const path = galleryPathFromPublicUrl(url);
  if (!path) {
    return { status: "failed", error: "Cover URL is not a gallery object" };
  }

  try {
    // Installed storage-js remove() returns { data, error }. Missing objects are
    // documented as idempotent success ({ data: [], error: null }) → deleted.
    const { error } = await supabase.storage.from(GALLERY_BUCKET).remove([path]);
    if (!error) return { status: "deleted" };
    logger.error("[gallery] cover revoke failed", { path, error: error.message });
    return { status: "failed", error: error.message };
  } catch (error) {
    const message = revokeErrorMessage(error);
    logger.error("[gallery] cover revoke failed", { path, error: message });
    return { status: "failed", error: message };
  }
}

export function createGalleryCoverLifecycle(): GalleryCoverLifecycle {
  return {
    revokeCover: revokeGalleryCover,
  };
}
