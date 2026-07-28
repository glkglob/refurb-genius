/**
 * Auth callback post-auth destination resolver (AO-1F1).
 *
 * Preserves the exact pre-extraction callback rule:
 *   redirectTo && redirectTo.startsWith("/") ? redirectTo : "/dashboard"
 *
 * Intentionally does not harden protocol-relative URLs (e.g. //host) or
 * reject /auth paths — those are adjacent security/product debt outside AO-1F1.
 */
export function resolveAuthCallbackDestination(redirectTo?: string): string {
  return redirectTo && redirectTo.startsWith("/") ? redirectTo : "/dashboard";
}
