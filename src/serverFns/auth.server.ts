/**
 * Server-only auth helpers.
 *
 * This module must NEVER be imported from client routes/components.
 * Import only from inside createServerFn `.handler()` bodies (dynamic import)
 * or from other `*.server.ts` modules.
 *
 * Client-safe serverFn *declarations* live in `./auth.ts`.
 *
 * Note: AuthUser shape is inlined (not imported from @/lib/auth) so this file
 * stays outside the no-legacy-imports allowlist surface.
 */
import type { Database } from "@repo/supabase";

/** Matches the app AuthUser shape used by client auth / useAuth. */
export type AuthUser = {
  id: string;
  email: string;
  fullName?: string;
};

export function mapSupabaseUserToAuthUser(
  u:
    | { id: string; email?: string | null; user_metadata?: Record<string, unknown> }
    | null
    | undefined,
): AuthUser | null {
  if (!u) return null;

  const meta = u.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === "string" ? meta.full_name : undefined) ??
    (typeof meta.name === "string" ? meta.name : undefined);

  return {
    id: u.id,
    email: u.email ?? "",
    fullName,
  };
}

/**
 * Fresh cookie-authenticated Supabase client for the current request.
 * cookieName must match the browser client ("pip-auth").
 */
export async function createSupabaseServerClient() {
  const { getCookies } = await import("@tanstack/react-start/server");
  const { createServerSupabase } = await import("@repo/supabase/server");

  return createServerSupabase<Database>(getCookies(), { cookieName: "pip-auth" });
}

/**
 * Guard for use exclusively inside createServerFn handlers.
 * @throws Error "You must be signed in." when unauthenticated.
 */
export async function requireUser(): Promise<AuthUser> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Failed to read auth session on the server: ${error.message}`);
  }

  const mapped = mapSupabaseUserToAuthUser(user);
  if (!mapped) {
    throw new Error("You must be signed in.");
  }
  return mapped;
}
