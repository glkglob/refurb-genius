/**
 * Native RLS room-analysis reads (IOS-2C3-I-P1).
 *
 * Redesign currentness uses durable room_analyses (source ai|fallback).
 * Native must read those rows with Keychain getNativeSupabase so RLS sees
 * auth.uid(). Browser-cookie Supabase returns empty on Capacitor.
 *
 * SELECT-only. Analysis generate/publish remains replace_project_room_analyses.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";

export type NativeRoomAnalysisRow = Database["public"]["Tables"]["room_analyses"]["Row"];

/**
 * List room analyses for one project under the authenticated native session.
 * RLS filters by user_id = auth.uid(); callers must not pass a user id.
 */
export async function listRoomAnalysesWithClient(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<NativeRoomAnalysisRow[]> {
  const { data, error } = await supabase
    .from("room_analyses")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  if (data != null && !Array.isArray(data)) {
    throw new Error("Room analyses response was not an array");
  }
  return data ?? [];
}

/** Production entry: list via native Keychain client. */
export async function listRoomAnalysesNative(projectId: string): Promise<NativeRoomAnalysisRow[]> {
  const { getNativeSupabase } = await import("./native");
  return listRoomAnalysesWithClient(getNativeSupabase(), projectId);
}
