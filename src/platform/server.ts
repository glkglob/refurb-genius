/**
 * Platform boundary — server-only aggregate.
 *
 * Typed entry point for vendor capabilities used inside `createServerFn`
 * handlers and `*.server.ts` modules. Never import this from client code —
 * it pulls server-only SDKs (OpenAI) into the bundle. Pair the Supabase
 * factories with `getCookies()` from `@tanstack/react-start/server`.
 */
import { createServerSupabase, createTokenSupabase } from "@repo/supabase/server";
import { createLogger } from "@/platform/logger";
import { getOpenAIClient } from "@/platform/openai/server";
import { createPaymentProvider } from "@/platform/payments";
import { getPostHogServerClient } from "@/platform/posthog/server";
import { createStorage } from "@/platform/storage";

export const platform = {
  supabase: {
    createServerClient: createServerSupabase,
    createTokenClient: createTokenSupabase,
  },
  ai: {
    getOpenAIClient,
  },
  posthog: {
    getServerClient: getPostHogServerClient,
  },
  logger: {
    createClient: createLogger,
  },
  payments: {
    createProvider: createPaymentProvider,
  },
  storage: {
    createClient: createStorage,
  },
} as const;

export type ServerPlatform = typeof platform;
