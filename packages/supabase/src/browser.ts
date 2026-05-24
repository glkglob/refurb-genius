// @repo/supabase — Browser (client-side) Supabase factory.
//
// Returns a lazily-initialised SupabaseClient that reads credentials
// from the environment and supports per-app cookie configuration.
// The proxy pattern ensures the client is only created once, on first
// property access — no top-level side-effects for SSR bundles.

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSupabaseEnv } from "./env";

/** Per-app cookie configuration. */
export interface BrowserClientOptions {
  /** Cookie name used for the auth session (default: "sb-auth"). */
  cookieName?: string;
  /**
   * Cookie domain — omit in development (defaults to current host).
   * In production, set to your shared domain (e.g. ".refurbgenius.space")
   * so the cookie is sent across subdomains.
   */
  cookieDomain?: string;
  /** Whether the cookie should be `Secure` (default: true in production). */
  secure?: boolean;
}

/**
 * Create a lazily-initialised browser Supabase client.
 *
 * Uses a `Proxy` so that the actual `createBrowserClient` call is
 * deferred until the first property access. This is safe for SSR
 * bundles: the proxy itself has no side-effects.
 *
 * @typeParam DB - Your app's generated `Database` type.
 *
 * @example
 * ```ts
 * import type { Database } from "./types";
 * import { createBrowserSupabase } from "@repo/supabase/browser";
 *
 * export const supabase = createBrowserSupabase<Database>({
 *   cookieName: "pip-auth",
 *   cookieDomain: import.meta.env.DEV ? undefined : ".refurbgenius.space",
 * });
 * ```
 */
export function createBrowserSupabase<DB = unknown>(
  opts: BrowserClientOptions = {},
): SupabaseClient<DB> {
  const { cookieName = "sb-auth", cookieDomain, secure } = opts;

  let instance: SupabaseClient<DB> | undefined;

  return new Proxy({} as SupabaseClient<DB>, {
    get(_, prop, receiver) {
      if (!instance) {
        const { supabaseUrl, supabaseAnonKey } = assertSupabaseEnv();
        instance = createBrowserClient<DB>(supabaseUrl, supabaseAnonKey, {
          cookieOptions: {
            name: cookieName,
            ...(cookieDomain ? { domain: cookieDomain } : {}),
            path: "/",
            sameSite: "lax",
            secure: secure ?? (typeof location !== "undefined" && location.protocol === "https:"),
          },
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
      }
      return Reflect.get(instance, prop, receiver);
    },
  });
}
