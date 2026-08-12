/**
 * Native OAuth authorization-code extraction (IOS-READINESS-2B-3).
 *
 * Accepts only the frozen custom-scheme OAuth callback with exactly one
 * non-empty `code` query parameter. Never logs the callback URL or code.
 */
import { classifyAuthReturnUrl } from "@/platform/auth/native/auth-return";

const FORBIDDEN_QUERY_KEYS = ["token_hash", "access_token", "refresh_token"] as const;

/**
 * Extract a single PKCE authorization code from a native OAuth callback URL.
 * Throws a bounded Error on any rejected shape (no secret payload).
 */
export function extractNativeOAuthAuthorizationCode(callbackUrl: string): string {
  const surface = classifyAuthReturnUrl(callbackUrl);
  if (!surface || surface.kind !== "custom-scheme") {
    throw new Error("Invalid authentication return.");
  }

  let url: URL;
  try {
    url = new URL(callbackUrl);
  } catch {
    throw new Error("Invalid authentication return.");
  }

  // Reject fragment-based implicit grants / hash secrets entirely.
  if (url.hash !== "" && url.hash !== "#") {
    throw new Error("Invalid authentication return.");
  }

  for (const key of FORBIDDEN_QUERY_KEYS) {
    if (url.searchParams.has(key)) {
      throw new Error("Invalid authentication return.");
    }
  }

  const codes = url.searchParams.getAll("code");
  if (codes.length !== 1) {
    throw new Error("Invalid authentication return.");
  }

  const code = codes[0];
  if (typeof code !== "string" || code.trim().length === 0) {
    throw new Error("Invalid authentication return.");
  }

  return code;
}
