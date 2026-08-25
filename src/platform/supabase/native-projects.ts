/**
 * Native RLS project data-plane foundation (IOS-READINESS-2C-1).
 *
 * Proves list/create via getNativeSupabase() under RLS.
 * List/detail are wired from queries/projects.ts. Create is wired from
 * useCreateProject on native (web still uses createProjectServerFn).
 *
 * Native create JIT-refreshes the Keychain session (autoRefreshToken:false)
 * via resolveNativeAccessTokenFromAuth before insert. user_id comes from the
 * aligned getSession() identity, never from the payload.
 *
 * Web must continue using existing cookie/serverFn paths.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";
import {
  resolveNativeAccessTokenFromAuth,
  type NativeAccessTokenFailureReason,
} from "@/platform/http/native-access-token";

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
 * List projects owned by the authenticated native session.
 * Owner filter uses the trusted native session user id — never a caller argument.
 */
export async function listProjectsWithClient(
  supabase: SupabaseClient<Database>,
): Promise<NativeProjectRow[]> {
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();
  const userId = user?.id;
  if (sessionError || !userId) {
    throw new Error("You must be signed in.");
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

function nativeCreateAuthError(reason: NativeAccessTokenFailureReason): Error {
  if (reason === "refresh_failed") {
    return new Error("Your session expired. Sign in again.");
  }
  if (reason === "indeterminate") {
    return new Error("Could not verify your session. Sign in again.");
  }
  return new Error("You must be signed in.");
}

/**
 * Create a project owned by the authenticated native user.
 * JIT-refreshes a stale/near-expiry Keychain token first, then takes user_id
 * exclusively from the aligned auth session — never from the payload.
 */
export async function createProjectWithClient(
  supabase: SupabaseClient<Database>,
  input: NativeProjectInsertInput,
): Promise<NativeProjectRow> {
  const token = await resolveNativeAccessTokenFromAuth(supabase.auth);
  if (!token.ok) {
    throw nativeCreateAuthError(token.reason);
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (sessionError || !userId) {
    throw new Error("You must be signed in.");
  }

  const { data: row, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
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

/**
 * Read one project for the authenticated native session (RLS filters by auth.uid()).
 */
export async function getProjectWithClient(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<NativeProjectRow | null> {
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data ?? null;
}

/** Production entry: detail via native Keychain client. */
export async function getProjectNative(id: string): Promise<NativeProjectRow | null> {
  const { getNativeSupabase } = await import("./native");
  return getProjectWithClient(getNativeSupabase(), id);
}

/** Production entry: create via native Keychain client + JIT refresh + RLS. */
export async function createProjectNative(
  input: NativeProjectInsertInput,
): Promise<NativeProjectRow> {
  const { getNativeSupabase } = await import("./native");
  return createProjectWithClient(getNativeSupabase(), input);
}
