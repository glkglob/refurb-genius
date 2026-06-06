// @repo/supabase — Server-side Supabase client factory.
//
// Creates a per-request Supabase client that reads/writes auth tokens
// via cookies. Works with TanStack Start (getCookies), Next.js
// (cookies()), or any framework that can provide a cookie map.
//
// Unlike the browser client, server clients are NOT singletons: each
// request must get its own instance so user context is isolated.

import { createServerClient as _createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSupabaseEnv } from "./env";

/** A simple cookie map: name -> value. */
export type CookieMap = Record<string, string>;

/**
 * Create a per-request server Supabase client with cookie-based auth.
 *
 * @typeParam DB - Your app's generated `Database` type.
 * @param cookies - A flat `{ name: value }` map of the current request's cookies.
 *
 * @example TanStack Start:
 * ```ts
 * import { getCookies } from "@tanstack/react-start/server";
 * import { createServerSupabase } from "@repo/supabase/server";
 * import type { Database } from "@/integrations/supabase/types";
 *
 * const supabase = createServerSupabase<Database>(getCookies());
 * ```
 *
 * @example Next.js App Router:
 * ```ts
 * import { cookies } from "next/headers";
 * import { createServerSupabase } from "@repo/supabase/server";
 *
 * const cookieStore = await cookies();
 * const map = Object.fromEntries(cookieStore.getAll().map(c => [c.name, c.value]));
 * const supabase = createServerSupabase<Database>(map);
 * ```
 */
export interface ServerSupabaseOptions {
  /**
   * The cookie name prefix used by the browser Supabase client.
   *
   * MUST match the `cookieName` passed to `createBrowserSupabase` in your
   * app (currently "pip-auth"). Without this, `@supabase/ssr` derives the
   * storage key from the Supabase project URL — a different key than the one
   * the browser client wrote — and `auth.getUser()` returns null even when the
   * user is authenticated.
   *
   * This maps to `cookieOptions.name` on the underlying `createServerClient`,
   * which sets `storageKey` in `@supabase/supabase-js`'s auth layer.
   */
  cookieName?: string;
}

export function createServerSupabase<DB = unknown>(
  cookies: CookieMap,
  options?: ServerSupabaseOptions,
): SupabaseClient<DB> {
  const { supabaseUrl, supabaseAnonKey } = assertSupabaseEnv();

  return _createServerClient<DB>(supabaseUrl, supabaseAnonKey, {
    ...(options?.cookieName ? { cookieOptions: { name: options.cookieName } } : {}),
    cookies: {
      getAll() {
        return Object.entries(cookies).map(([name, value]) => ({ name, value }));
      },
    },
  });
}

/**
 * Create a Supabase client authenticated with a Bearer token.
 *
 * Useful for middleware patterns where the auth token is extracted
 * from the `Authorization` header rather than cookies.
 *
 * @typeParam DB - Your app's generated `Database` type.
 * @param token - The Bearer JWT token.
 */
export function createTokenSupabase<DB = unknown>(token: string): SupabaseClient<DB> {
  const { supabaseUrl, supabaseAnonKey } = assertSupabaseEnv();

  return createClient<DB>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Validate a JWT and return the authenticated user.
 *
 * Combines `createTokenSupabase` with `auth.getUser()` — a common
 * guard pattern for server middleware and API routes.
 *
 * @throws Error if the token is invalid or the user cannot be resolved.
 */
export async function verifyToken<DB = unknown>(
  token: string,
): Promise<{
  supabase: SupabaseClient<DB>;
  userId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
}> {
  const supabase = createTokenSupabase<DB>(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new Error("Unauthorized: invalid token");
  }
  return { supabase, userId: data.user.id, user: data.user };
}
