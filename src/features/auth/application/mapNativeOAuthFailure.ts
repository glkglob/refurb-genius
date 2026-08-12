/**
 * Native-safe OAuth failure copy (IOS-READINESS-2B-3).
 *
 * Bounded user-facing messages only. Never returns raw backend text, codes,
 * callback URLs, verifiers, or tokens.
 */

/** PKCE verifier missing / challenge mismatch family. */
export const NATIVE_OAUTH_PKCE_FAILURE_MESSAGE =
  "This sign-in could not be completed. Please try again from the app.";

/** Expired, invalid, or flow-state failure family. */
export const NATIVE_OAUTH_INVALID_OR_EXPIRED_MESSAGE =
  "This sign-in is invalid or has expired. Please try again.";

/** Generic native OAuth completion failure. */
export const NATIVE_OAUTH_GENERIC_FAILURE_MESSAGE =
  "We could not complete sign-in. Please try again.";

function readErrorProperty(error: unknown, key: "code" | "status" | "message"): unknown {
  if (error && typeof error === "object" && key in error) {
    return (error as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Map Auth / transport failures to bounded native user-facing copy.
 */
export function mapNativeOAuthFailure(error: unknown): string {
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
    "pkce_code_verifier_not_found",
  ];
  if (pkceSignals.some((signal) => message.includes(signal) || code.includes(signal))) {
    return NATIVE_OAUTH_PKCE_FAILURE_MESSAGE;
  }

  const invalidSignals = [
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
    "invalid request",
    "authorization code",
  ];
  if (
    invalidSignals.some((signal) => message.includes(signal) || code.includes(signal)) ||
    code === "otp_expired" ||
    code === "otp_disabled"
  ) {
    return NATIVE_OAUTH_INVALID_OR_EXPIRED_MESSAGE;
  }

  return NATIVE_OAUTH_GENERIC_FAILURE_MESSAGE;
}
