/**
 * Native RLS project-photo reads (IOS-2C3-I-P1).
 *
 * Redesign (and usePhotos) must see the durable photo catalogue under
 * Keychain getNativeSupabase. Cookie/browser Supabase has no native session,
 * so RLS returns an empty catalogue and the Analysis gate hides concepts.
 *
 * SELECT-only. Photo upload/delete remain sealed RPCs / photos-write.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";

export type NativePhotoRow = Database["public"]["Tables"]["photos"]["Row"];

/**
 * List photos for one project under the authenticated native session.
 * RLS filters by user_id = auth.uid(); callers must not pass a user id.
 */
export async function listPhotosWithClient(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<NativePhotoRow[]> {
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  if (data != null && !Array.isArray(data)) {
    throw new Error("Photos response was not an array");
  }
  return data ?? [];
}

/** Production entry: list via native Keychain client. */
export async function listPhotosNative(projectId: string): Promise<NativePhotoRow[]> {
  const { getNativeSupabase } = await import("./native");
  return listPhotosWithClient(getNativeSupabase(), projectId);
}
