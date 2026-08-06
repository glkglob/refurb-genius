/**
 * Auth callback post-auth destination resolver (P0-AUTH-1).
 *
 * Accepts only same-origin application paths:
 * - begin with exactly one "/";
 * - do not begin with "//";
 * - do not point back into /auth;
 * - do not contain a URL scheme;
 * - do not contain a hostname.
 *
 * Fallback: /dashboard
 */
const FALLBACK = "/dashboard";

function isAuthPath(path: string): boolean {
  return (
    path === "/auth" ||
    path.startsWith("/auth?") ||
    path.startsWith("/auth/") ||
    path.startsWith("/auth#")
  );
}

export function resolveAuthCallbackDestination(redirectTo?: string): string {
  if (!redirectTo) {
    return FALLBACK;
  }

  // Must be a single-slash absolute path (rejects protocol-relative "//…").
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return FALLBACK;
  }

  // Reject scheme-bearing or host-bearing values that slipped past the slash check.
  if (redirectTo.includes("://") || redirectTo.includes("\\")) {
    return FALLBACK;
  }

  if (isAuthPath(redirectTo)) {
    return FALLBACK;
  }

  return redirectTo;
}
