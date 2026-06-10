/**
 * Server auth primitives for TanStack Start + Supabase.
 *
 * @file src/serverFns/auth.ts
 *
 * This is the single source of truth for reading the current authenticated
 * user from *inside* `createServerFn` handlers and any other server-side
 * execution context (Nitro / Vercel / etc.).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS PATTERN IS MANDATORY FOR TANSTACK START + SSR / HARD REFRESH SAFETY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. Session lives in cookies, not in server memory
 *    - The browser Supabase client (src/lib/auth.ts + @repo/supabase/browser)
 *      stores the session in memory + sets auth cookies (currently "pip-auth"
 *      plus Supabase's sb-* cookies).
 *    - On client-side navigation the in-memory state is present → sidebar shows
 *      the user, hooks return a user, etc.
 *    - On hard refresh, direct URL paste, or any initial SSR render, that
 *      in-memory JS state does **not** exist on the server. The only thing the
 *      server receives is the cookies the browser automatically attaches to the
 *      request.
 *
 * 2. createServerFn always runs on the server
 *    - Even if called from hydrated client code, the `.handler()` body executes
 *      in the Nitro server (or Vercel function).
 *    - At that point there is no `window`, no React context, and the browser
 *      `supabase` singleton imported from "@/platform/supabase/browser" is either
 *      undefined or represents *the server's* view of the world (i.e. no user).
 *    - Using the browser client inside a serverFn is forbidden by CLAUDE.md and
 *      will always report "no user" after a hard refresh.
 *
 * 3. The cookie-based server client is the correct bridge
 *    - `@tanstack/react-start/server`.getCookies() extracts a plain
 *      `Record<string,string>` of every cookie present on the *current request*
 *      using h3's async-local-storage request context. It is safe, per-request,
 *      and works identically in dev, SSR, and production.
 *    - `@repo/supabase/server`.createServerSupabase(cookieMap) feeds those
 *      cookies into `@supabase/ssr`'s `createServerClient`. The resulting client
 *      is a *fresh instance per request* — exactly what you need so User A never
 *      sees User B's data.
 *    - Once you have that client you can call `supabase.auth.getUser()` and it
 *      will validate the JWT from the cookies against Supabase and return the
 *      real user (or null).
 *
 * 4. Dynamic imports are non-negotiable
 *    - Any static `import { createServerSupabase } from "@repo/supabase/server"`
 *      at the top of a file that is imported by client bundles causes either
 *      a build error or (worse) silent inclusion of Node/Deno-only code in the
 *      browser bundle.
 *    - Therefore the import of both `@tanstack/react-start/server` and
 *      `@repo/supabase/server` must live *inside* the functions that only ever
 *      run on the server (i.e. inside `.handler()` bodies and helpers called
 *      exclusively from handlers).
 *
 * 5. Consistency & future-proofing
 *    - Previously the only copy of this pattern lived inside
 *      `src/core/ai/serverFns.ts` as a private `requireServerAuth()`.
 *    - Centralising it here means every future serverFn (trades, projects,
 *      deal-copilot, admin, etc.) gets the correct primitive in one line.
 *    - It also gives us a place to add logging, metrics, or future token
 *      refresh logic without touching dozens of call sites.
 *
 * Usage rules (enforced by this file + CLAUDE.md):
 *   - Always import the *serverFns* you need from here (or call the helpers).
 *   - Never import browser Supabase clients in serverFns.
 *   - Prefer `await requireUser()` when the operation must be authenticated.
 *   - Use `await getCurrentUserServerFn()` when you want to branch on
 *     "maybe logged in".
 *
 * This file, together with the packages/supabase server helpers and the
 * existing client auth layer, gives us a complete, SSR-safe auth story.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Type-only imports — 100% safe at the top level. They produce zero runtime
// code and do not pull any browser-only modules into server bundles.
import type { AuthUser } from "@/lib/auth";
import type { Database } from "@repo/supabase";

/**
 * Empty input schema.
 *
 * Every `createServerFn` in this codebase uses an explicit Zod validator
 * (see all four functions in src/core/ai/serverFns.ts). Even functions that
 * take no arguments still declare `z.object({})` so the contract is obvious
 * and future input can be added without changing the call site shape.
 */
const emptyInputSchema = z.object({});

/**
 * Maps a raw Supabase `User` object (returned by auth.getUser) into the
 * exact `AuthUser` shape used everywhere else in the app.
 *
 * This keeps the two worlds (client `lib/auth.ts` and serverFns) in sync so
 * that `user.fullName`, `user.email` etc. behave identically regardless of
 * whether the value came from `useAuth()`, `auth.getUser()`, or a serverFn.
 *
 * The mapping logic is intentionally duplicated from the non-exported
 * `fromSupabaseUser` helper in src/lib/auth.ts — importing the function would
 * have pulled the entire browser auth module (and its side effects) into the
 * server bundle.
 */
function mapSupabaseUserToAuthUser(
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
 * Creates a fresh, cookie-authenticated Supabase client bound to the
 * *current incoming HTTP request*.
 *
 * This is the primitive every other server auth helper builds on.
 *
 * Returns a fully-typed `SupabaseClient<Database>` so that `.from(...)`,
 * `auth.getUser()`, RLS-respecting queries etc. all have excellent IntelliSense.
 *
 * IMPORTANT:
 *   - Must only be called from server execution contexts (inside
 *     `createServerFn` handlers, middleware that runs on the server, etc.).
 *   - The client is cheap to create and must never be stored in a global /
 *     module-level cache — each request needs its own instance.
 *   - All imports are dynamic so that this module remains safe to import
 *     from client components (only the serverFn *declarations* cross the
 *     boundary; handler bodies are stripped for the client bundle).
 *
 * @example
 * ```ts
 * // inside any .handler()
 * const supabase = await createSupabaseServerClient();
 * const { data } = await supabase.from("projects").select("*");
 * ```
 */
export async function createSupabaseServerClient() {
  const { getCookies } = await import("@tanstack/react-start/server");
  const { createServerSupabase } = await import("@repo/supabase/server");

  // cookieName MUST match the value used by the browser client in
  // src/services/supabase/_client.ts — both must be "pip-auth" so that
  // @supabase/ssr uses the same storageKey on client and server.
  // Without this the server would look for the default "sb-<project>-auth-token"
  // cookie and return null for every authenticated user.
  return createServerSupabase<Database>(getCookies(), { cookieName: "pip-auth" });
}

/**
 * `createServerFn` that returns the currently authenticated user (or null)
 * using only server-side cookie data.
 *
 * This is the function you call from *within* other serverFns when you need
 * to know "who is making this request on the server?".
 *
 * Contract:
 *   - Method is POST (consistent with all other serverFns in the app).
 *   - Accepts no payload (validated by an explicit empty Zod schema).
 *   - On success always returns a plain serialisable object:
 *       `{ user: AuthUser | null }`
 *   - Throws only on infrastructure / unexpected errors. "No user" is
 *     represented by `user === null`, not by an exception.
 *
 * Consumers (other serverFns):
 *   const { user } = await getCurrentUserServerFn();
 *   if (!user) {
 *     // branch for anonymous or redirect / throw via requireUser
 *   }
 */
export const getCurrentUserServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => emptyInputSchema.parse(input))
  .handler(async () => {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      // We surface a clear error rather than swallowing — this usually means
      // a misconfigured JWT, network problem talking to Supabase, or an
      // expired / tampered cookie. The caller can decide how to handle it.
      throw new Error(`Failed to read auth session on the server: ${error.message}`);
    }

    return {
      user: mapSupabaseUserToAuthUser(user),
    };
  });

/**
 * Guard helper for use *exclusively inside* `createServerFn` handlers.
 *
 * Calls `getCurrentUserServerFn`, then throws a friendly error if no user
 * is present. This is the server-side equivalent of the client-side
 * `RequireAuth` component + the old duplicated `requireServerAuth` logic.
 *
 * The exact error message "You must be signed in." is chosen so it matches
 * the symptom reported in the original auth bug ("You must be signed in")
 * and can be shown directly to users or used in error boundaries.
 *
 * @returns The authenticated `AuthUser` when present.
 * @throws Error with message "You must be signed in." when unauthenticated.
 *
 * @example
 * ```ts
 * export const doSomethingProtected = createServerFn({ method: "POST" })
 *   .handler(async ({ data }) => {
 *     const user = await requireUser(); // ← throws for anonymous callers
 *     // ... proceed with user.id etc.
 *   });
 * ```
 */
export async function requireUser(): Promise<AuthUser> {
  const { user } = await getCurrentUserServerFn();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  return user;
}
