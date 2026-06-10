/**
 * Platform boundary — Supabase (server context).
 *
 * For use inside `createServerFn` handlers only (pair with `getCookies()` from
 * `@tanstack/react-start/server`). Browser code must use
 * `@/platform/supabase/browser`.
 */
export { createServerSupabase, createTokenSupabase } from "@repo/supabase/server";
