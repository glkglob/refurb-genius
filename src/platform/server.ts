/**
 * Platform boundary — server-only aggregate.
 *
 * Typed entry point for vendor capabilities used inside `createServerFn`
 * handlers and `*.server.ts` modules. Never import this from client code —
 * it pulls server-only SDKs (OpenAI) into the bundle. Pair the Supabase
 * factories with `getCookies()` from `@tanstack/react-start/server`.
 */
import { createServerSupabase, createTokenSupabase } from "@repo/supabase/server";
import { getOpenAIClient } from "@/core/ai/server/openai-client";

export const platform = {
  supabase: {
    createServerClient: createServerSupabase,
    createTokenClient: createTokenSupabase,
  },
  ai: {
    getOpenAIClient,
  },
} as const;

export type ServerPlatform = typeof platform;
