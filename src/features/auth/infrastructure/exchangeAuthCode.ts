/**
 * Authorization-code exchange Auth primitive (AO-1F1).
 *
 * Exact supabase.auth.exchangeCodeForSession wrapper for the Auth callback
 * route. Returned Auth errors are thrown unchanged. Presentation-free (no
 * React, window, mapping, QueryClient, logger, toast, or navigation).
 */
import { supabase } from "@/platform/supabase/browser";

export interface ExchangeAuthCodeInput {
  code: string;
}

/**
 * Exchange a PKCE authorization code for an Auth session.
 * Caller owns mapping, cache seed, redirect resolution, and navigation.
 */
export async function exchangeAuthCode(input: ExchangeAuthCodeInput) {
  const { data, error } = await supabase.auth.exchangeCodeForSession(input.code);
  if (error) {
    throw error;
  }
  return { user: data.user };
}

export type ExchangeAuthCodeResult = Awaited<ReturnType<typeof exchangeAuthCode>>;
