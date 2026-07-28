/**
 * Browser Auth session retrieval primitive (AO-1F1).
 *
 * Exact supabase.auth.getSession wrapper for the Auth callback no-code path
 * (e.g. fragment-based session already established). Presentation-free (no
 * React, window, mapping, QueryClient, logger, toast, or navigation).
 *
 * Returned error field is ignored — parity with the pre-extraction callback
 * which only inspected data.session presence.
 */
import { supabase } from "@/platform/supabase/browser";

/**
 * Read the current browser Auth session user, if any.
 * Returns null when no session exists. Rejected promises propagate.
 * Caller owns mapping, cache seed, and navigation.
 */
export async function getBrowserAuthSession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    return null;
  }
  return { user: data.session.user };
}

export type BrowserAuthSessionResult = NonNullable<
  Awaited<ReturnType<typeof getBrowserAuthSession>>
>;
