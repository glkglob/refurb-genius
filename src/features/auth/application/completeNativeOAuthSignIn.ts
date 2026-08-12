/**
 * Native OAuth completion application orchestration (IOS-READINESS-2B-3).
 *
 * Pure application flow:
 * 1. extract authorization code from custom-scheme callback
 * 2. exchange via native Supabase PKCE client
 * 3. map user
 * 4. resolve safe post-auth destination
 *
 * No React, cache client, routing, logging, or product telemetry.
 * Presentation owns auth query seed and post-auth routing.
 */
import type { AuthUser } from "@/lib/auth";
import { extractNativeOAuthAuthorizationCode } from "../infrastructure/extractNativeOAuthAuthorizationCode";
import { exchangeNativeAuthCode } from "../infrastructure/exchangeNativeAuthCode";
import { mapNativeOAuthFailure } from "./mapNativeOAuthFailure";
import { mapNativeSupabaseUser } from "./mapNativeSupabaseUser";
import { resolveAuthCallbackDestination } from "./resolveAuthCallbackDestination";

export interface CompleteNativeOAuthSignInInput {
  callbackUrl: string;
  redirectTo?: string;
}

export type NativeOAuthCompletionResult =
  | {
      kind: "authenticated";
      user: AuthUser;
      destination: string;
    }
  | {
      kind: "error";
      message: string;
    };

/**
 * Complete native OAuth after a validated custom-scheme callback URL is available.
 */
export async function completeNativeOAuthSignIn(
  input: CompleteNativeOAuthSignInInput,
): Promise<NativeOAuthCompletionResult> {
  try {
    const code = extractNativeOAuthAuthorizationCode(input.callbackUrl);
    const { user: rawUser } = await exchangeNativeAuthCode({ code });
    const user = mapNativeSupabaseUser(rawUser);
    if (!user) {
      return {
        kind: "error",
        message: mapNativeOAuthFailure(new Error("missing user")),
      };
    }

    const destination = resolveAuthCallbackDestination(input.redirectTo);
    return {
      kind: "authenticated",
      user,
      destination,
    };
  } catch (error: unknown) {
    // Extract/classify failures use generic "Invalid authentication return."
    // Map those to generic native copy without raw secrets.
    if (error instanceof Error && error.message === "Invalid authentication return.") {
      return {
        kind: "error",
        message: mapNativeOAuthFailure(error),
      };
    }
    return {
      kind: "error",
      message: mapNativeOAuthFailure(error),
    };
  }
}
