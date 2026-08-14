/**
 * Native sealed redesign selection (IOS-2C3-I).
 *
 * Direct table UPDATE is revoked. Selection uses the existing
 * select_project_redesign_concept RPC under Keychain getNativeSupabase.
 * Identity is auth.uid() inside the RPC — callers must not send userId.
 *
 * Returns the live row. Presentation maps with rowToDurableRedesignConcept.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";
import type { NativeRedesignConceptRow } from "./native-redesign-concepts";

export type SelectRedesignConceptNativeInput = {
  projectId: string;
  conceptId: string;
};

function selectRpcError(message: string): Error {
  const msg = message ?? "";
  if (/redesign_concept_not_found|P0002/i.test(msg)) {
    return new Error("Redesign concept not found for this project");
  }
  if (/project_not_authorised|42501/i.test(msg)) {
    return new Error("Not authorised for this project");
  }
  if (/not_authenticated|28000/i.test(msg)) {
    return new Error("Not authenticated");
  }
  return new Error(msg || "Failed to persist redesign selection");
}

export async function selectRedesignConceptWithClient(
  supabase: SupabaseClient<Database>,
  input: SelectRedesignConceptNativeInput,
): Promise<NativeRedesignConceptRow> {
  const { data, error } = await supabase.rpc("select_project_redesign_concept", {
    p_project_id: input.projectId,
    p_concept_id: input.conceptId,
  });

  if (error) {
    throw selectRpcError(error.message ?? "");
  }

  const row = (Array.isArray(data) ? data[0] : data) as NativeRedesignConceptRow | null;
  if (!row?.id) {
    throw new Error("Selection did not persist");
  }

  if (!row.is_selected) {
    const { listRedesignConceptsWithClient } = await import("./native-redesign-concepts");
    const rows = await listRedesignConceptsWithClient(supabase, input.projectId);
    const selected = rows.find((c) => c.id === input.conceptId && c.is_selected);
    if (!selected) throw new Error("Selection did not persist");
    return selected;
  }
  return row;
}

export async function selectRedesignConceptNative(
  input: SelectRedesignConceptNativeInput,
): Promise<NativeRedesignConceptRow> {
  const { getNativeSupabase } = await import("./native");
  return selectRedesignConceptWithClient(getNativeSupabase(), input);
}
