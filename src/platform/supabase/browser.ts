/**
 * Platform boundary — Supabase (browser context).
 *
 * Slice infrastructure imports Supabase through this seam instead of
 * `@supabase/supabase-js` or `@repo/supabase` directly, so the vendor can be
 * swapped (or instrumented) in one place. Server contexts must use
 * `@/platform/supabase/server` — never mix the two in one barrel.
 */
export { createBrowserSupabase } from "@repo/supabase/browser";
export { resolveSupabaseEnv } from "@repo/supabase/env";

/**
 * The app-wide browser client singleton. It currently lives in
 * `src/services/supabase` (many legacy importers); slices import it from
 * here so that when the singleton moves into the platform layer, only this
 * line changes. TODO(feature-slice): invert — define the singleton here.
 */
export { supabase } from "@/services/supabase";
