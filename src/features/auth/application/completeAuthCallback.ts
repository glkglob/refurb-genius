/**
 * Auth callback completion orchestration (P0-AUTH-1).
 *
 * Pure application flow for the Auth callback route:
 * 1. URL/provider error
 * 2. Resolve safe destination
 * 3. token-hash magic-link branch (cross-browser)
 * 4. authorization-code PKCE branch (OAuth / recovery / same-browser)
 * 5. existing-session fallback
 * 6. missing callback error
 *
 * No React, QueryClient, navigation, logger, or toast.
 * User-facing errors are bounded; raw backend text is not returned.
 */
import { fromSupabaseUser, type AuthUser } from "@/lib/auth";
import { exchangeAuthCode } from "../infrastructure/exchangeAuthCode";
import { getBrowserAuthSession } from "../infrastructure/getBrowserAuthSession";
import { verifyEmailTokenHash } from "../infrastructure/verifyEmailTokenHash";
import { resolveAuthCallbackDestination } from "./resolveAuthCallbackDestination";

export interface CompleteAuthCallbackInput {
  code?: string;
  tokenHash?: string;
  type?: string;
  urlError?: string;
  errorDescription?: string;
  redirectTo?: string;
}

export type AuthCallbackCompletionResult =
  | {
      kind: "error";
      message: string;
    }
  | {
      kind: "recovery";
    }
  | {
      kind: "authenticated";
      user: AuthUser | null;
      destination: string;
    };

/** Safe message when PKCE verifier is missing or invalid in this browser. */
export const AUTH_CALLBACK_BROWSER_MISMATCH_MESSAGE =
  "This sign-in link was opened in a different browser or the original sign-in session is no longer available. Request a new link and open the new email in this browser.";

/** Safe message for expired, reused, or invalid OTP / token-hash links. */
export const AUTH_CALLBACK_INVALID_LINK_MESSAGE =
  "This sign-in link is invalid or has expired. Request a new link and try again.";

/** Safe generic callback failure. */
export const AUTH_CALLBACK_GENERIC_FAILURE_MESSAGE =
  "We could not complete sign-in. Request a new link and try again.";

function readErrorProperty(error: unknown, key: "code" | "status" | "message"): unknown {
  if (error && typeof error === "object" && key in error) {
    return (error as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Map Auth / transport failures to bounded user-facing copy.
 * Never includes tokens, codes, or full callback URLs.
 */
export function mapAuthCallbackFailure(error: unknown): string {
  const code = String(readErrorProperty(error, "code") ?? "").toLowerCase();
  const message = String(
    readErrorProperty(error, "message") ?? (error instanceof Error ? error.message : ""),
  ).toLowerCase();

  const pkceSignals = [
    "code verifier",
    "pkce",
    "code challenge",
    "both auth code and code verifier",
    "auth code and code verifier",
  ];
  if (pkceSignals.some((signal) => message.includes(signal) || code.includes(signal))) {
    return AUTH_CALLBACK_BROWSER_MISMATCH_MESSAGE;
  }

  const invalidLinkSignals = [
    "otp_expired",
    "otp_disabled",
    "expired",
    "invalid token",
    "invalid otp",
    "token has expired",
    "token is invalid",
    "flow_state",
    "email link is invalid",
    "magic link",
  ];
  if (
    invalidLinkSignals.some((signal) => message.includes(signal) || code.includes(signal)) ||
    code === "otp_expired" ||
    code === "otp_disabled"
  ) {
    return AUTH_CALLBACK_INVALID_LINK_MESSAGE;
  }

  return AUTH_CALLBACK_GENERIC_FAILURE_MESSAGE;
}

/**
 * Complete Auth callback orchestration for the given search-derived input.
 * Caller (presentation hook) owns QueryClient seed and navigation.
 */
export async function completeAuthCallback(
  input: CompleteAuthCallbackInput,
): Promise<AuthCallbackCompletionResult> {
  if (input.urlError) {
    return {
      kind: "error",
      message: input.errorDescription ?? input.urlError,
    };
  }

  const destination = resolveAuthCallbackDestination(input.redirectTo);

  // Path A — token-hash magic link (cross-browser / cross-device).
  if (input.tokenHash) {
    if (input.type !== "email") {
      return {
        kind: "error",
        message: AUTH_CALLBACK_INVALID_LINK_MESSAGE,
      };
    }
    try {
      const { user } = await verifyEmailTokenHash({ tokenHash: input.tokenHash });
      return {
        kind: "authenticated",
        user: fromSupabaseUser(user),
        destination,
      };
    } catch (error: unknown) {
      return {
        kind: "error",
        message: mapAuthCallbackFailure(error),
      };
    }
  }

  // Path B — authorization code (OAuth, recovery, same-browser PKCE magic link).
  if (input.code) {
    try {
      const { user } = await exchangeAuthCode({ code: input.code });
      if (input.type === "recovery") {
        return { kind: "recovery" };
      }
      return {
        kind: "authenticated",
        user: fromSupabaseUser(user),
        destination,
      };
    } catch (error: unknown) {
      return {
        kind: "error",
        message: mapAuthCallbackFailure(error),
      };
    }
  }

  // Existing session fallback (e.g. fragment-based session already established).
  // Rejected promises intentionally propagate (no .catch on pre-extraction path).
  const session = await getBrowserAuthSession();
  if (session) {
    return {
      kind: "authenticated",
      user: fromSupabaseUser(session.user),
      destination,
    };
  }

  return {
    kind: "error",
    message: AUTH_CALLBACK_GENERIC_FAILURE_MESSAGE,
  };
}
