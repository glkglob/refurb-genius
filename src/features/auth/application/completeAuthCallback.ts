/**
 * Auth callback completion orchestration (AO-1F1).
 *
 * Pure application flow for the Auth callback route: URL errors, no-code
 * session fallback, PKCE exchange, recovery branch, user mapping, and
 * destination resolution. No React, QueryClient, navigation, logger, or toast.
 *
 * Rejected getBrowserAuthSession promises propagate (parity with the
 * pre-extraction no-code branch that had no .catch).
 * Exchange failures are converted to error results (parity with the
 * pre-extraction exchange .catch / returned-error paths).
 */
import { fromSupabaseUser, type AuthUser } from "@/lib/auth";
import { exchangeAuthCode } from "../infrastructure/exchangeAuthCode";
import { getBrowserAuthSession } from "../infrastructure/getBrowserAuthSession";
import { resolveAuthCallbackDestination } from "./resolveAuthCallbackDestination";

export interface CompleteAuthCallbackInput {
  code?: string;
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

function exchangeFailureMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Auth callback failed.";
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

  if (!input.code) {
    // No PKCE code — check if a session already exists (e.g. fragment-based flow).
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
      message: "No authentication code received. Please try signing in again.",
    };
  }

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
      message: exchangeFailureMessage(error),
    };
  }
}
