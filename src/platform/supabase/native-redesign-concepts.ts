/**
 * Native RLS redesign-concept reads (IOS-2C3-H).
 *
 * Cookie createServerFn cannot run inside the Capacitor SPA (no server.url).
 * Native list uses Keychain getNativeSupabase so RLS sees auth.uid().
 *
 * Writes remain sealed RPCs / serverFns — this module is SELECT-only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";

export type NativeRedesignConceptRow = Pick<
  Database["public"]["Tables"]["redesign_concepts"]["Row"],
  "id" | "style" | "title" | "description" | "image_url" | "analysis_identity" | "is_selected"
>;

/**
 * List redesign concepts for one project under the authenticated native session.
 * RLS filters by user_id = auth.uid(); callers must not pass a user id.
 */
export async function listRedesignConceptsWithClient(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<NativeRedesignConceptRow[]> {
  const { data, error } = await supabase
    .from("redesign_concepts")
    .select("id, style, title, description, image_url, analysis_identity, is_selected")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  if (data != null && !Array.isArray(data)) {
    throw new Error("Redesign concepts response was not an array");
  }
  return data ?? [];
}

/** Production entry: list via native Keychain client. */
export async function listRedesignConceptsNative(
  projectId: string,
): Promise<NativeRedesignConceptRow[]> {
  const { getNativeSupabase } = await import("./native");
  return listRedesignConceptsWithClient(getNativeSupabase(), projectId);
}
