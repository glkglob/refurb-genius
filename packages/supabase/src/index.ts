// @repo/supabase — Shared Supabase client factories and env helpers.
//
// Browser client:  import { createBrowserSupabase } from "@repo/supabase/browser"
// Server client:   import { createServerSupabase }  from "@repo/supabase/server"
// Env helpers:     import { resolveSupabaseEnv }     from "@repo/supabase/env"
//
// Or import everything from the root:
//   import { createBrowserSupabase, createServerSupabase, resolveSupabaseEnv } from "@repo/supabase"

export { createBrowserSupabase, type BrowserClientOptions } from "./browser";
export { createServerSupabase, createTokenSupabase, verifyToken, type CookieMap } from "./server";
export { resolveSupabaseEnv, assertSupabaseEnv, type SupabaseEnv } from "./env";
