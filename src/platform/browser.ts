/**
 * Platform boundary — browser-safe aggregate.
 *
 * Typed entry point for vendor capabilities usable in client code. Factories,
 * not instances: clients are created where they're wired so SSR/build never
 * instantiates them at module scope. Server-only vendors (OpenAI, …) are
 * deliberately absent — see `@/platform/server`.
 */
import { createBrowserSupabase } from "@repo/supabase/browser";
import { resolveSupabaseEnv } from "@repo/supabase/env";
import { posthog } from "@/platform/posthog/browser";

export const platform = {
  supabase: {
    createClient: createBrowserSupabase,
    resolveEnv: resolveSupabaseEnv,
  },
  posthog: {
    client: posthog,
  },
} as const;

export type BrowserPlatform = typeof platform;
