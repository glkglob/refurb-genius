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
import { createAnalytics } from "@/platform/analytics";
import { createAuthProvider } from "@/platform/auth";
import { createLogger } from "@/platform/logger";
import { createPaymentProvider } from "@/platform/payments";
import { posthog } from "@/platform/posthog/browser";
import { createSentry } from "@/platform/sentry";
import { createStorage } from "@/platform/storage";

export const platform = {
  supabase: {
    createClient: createBrowserSupabase,
    resolveEnv: resolveSupabaseEnv,
  },
  posthog: {
    client: posthog,
  },
  auth: {
    createProvider: createAuthProvider,
  },
  analytics: {
    createClient: createAnalytics,
  },
  logger: {
    createClient: createLogger,
  },
  sentry: {
    createClient: createSentry,
  },
  payments: {
    createProvider: createPaymentProvider,
  },
  storage: {
    createClient: createStorage,
  },
} as const;

export type BrowserPlatform = typeof platform;
