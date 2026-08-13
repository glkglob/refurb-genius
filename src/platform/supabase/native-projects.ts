/**
 * Native RLS project data-plane foundation (IOS-READINESS-2C-1).
 *
 * Proves list/create via getNativeSupabase() under RLS.
 * Not wired into useProjects / createProjectServerFn consumers in this phase (2C-3).
 *
 * Web must continue using existing cookie/serverFn paths.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";

export type NativeProjectInsertInput = {
  name: string;
  address?: string;
  postcode?: string;
  region?: string;
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  size_sqm?: number;
  purchase_price?: number;
  estimated_gdv?: number;
  notes?: string;
};

export type NativeProjectRow = Database["public"]["Tables"]["projects"]["Row"];

/**
 * List projects for the authenticated native session (RLS filters by auth.uid()).
 */
export async function listProjectsWithClient(
  supabase: SupabaseClient<Database>,
): Promise<NativeProjectRow[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

/**
 * Create a project owned by the authenticated native user.
 * user_id is taken exclusively from auth.getUser() — never from the payload.
 */
export async function createProjectWithClient(
  supabase: SupabaseClient<Database>,
  input: NativeProjectInsertInput,
): Promise<NativeProjectRow> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    throw new Error("You must be signed in.");
  }

  const { data: row, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      address: input.address?.trim() ?? "",
      postcode: input.postcode?.trim() ?? "",
      region: input.region ?? "London",
      property_type: input.property_type ?? "Terraced",
      bedrooms: input.bedrooms ?? 0,
      bathrooms: input.bathrooms ?? 0,
      size_sqm: input.size_sqm ?? 0,
      purchase_price: input.purchase_price ?? 0,
      estimated_gdv: input.estimated_gdv ?? 0,
      notes: input.notes ?? "",
      status: "Draft",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }
  if (!row) {
    throw new Error("Project create returned no row");
  }
  return row;
}

/** Production entry: list via native Keychain client. */
export async function listProjectsNative(): Promise<NativeProjectRow[]> {
  const { getNativeSupabase } = await import("./native");
  return listProjectsWithClient(getNativeSupabase());
}

/** Production entry: create via native Keychain client + RLS. */
export async function createProjectNative(
  input: NativeProjectInsertInput,
): Promise<NativeProjectRow> {
  const { getNativeSupabase } = await import("./native");
  return createProjectWithClient(getNativeSupabase(), input);
}
