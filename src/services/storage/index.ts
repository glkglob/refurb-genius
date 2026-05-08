// Storage service boundary.
//
// Wraps the Supabase Storage `project-photos` bucket and the `photos`
// metadata table. Components and pages should import upload / list /
// remove operations from here instead of touching `supabase.storage`
// directly — keeps bucket name, path layout, and RLS assumptions in one
// place.
import { supabase, isSupabaseConfigured } from "@/services/supabase";
import { photoStore, formatFileSize } from "@/lib/photos";
import type { ProjectPhoto } from "@/lib/photos";

export const PROJECT_PHOTOS_BUCKET = "project-photos";

/** Public URL for a stored object in the project-photos bucket. */
export function getPublicPhotoUrl(storagePath: string): string {
  const { data } = supabase.storage
    .from(PROJECT_PHOTOS_BUCKET)
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

/** Soft guard so callers can show a setup warning before attempting uploads. */
export function canUseStorage(): boolean {
  return isSupabaseConfigured();
}

// Re-export the existing photo store + helpers as the canonical service API.
export { photoStore, formatFileSize };
export type { ProjectPhoto };
