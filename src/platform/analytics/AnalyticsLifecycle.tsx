/**
 * OBS-T1 — single application authorities for:
 * 1) PostHog identity lifecycle (driven by resolved auth)
 * 2) Manual SPA `$pageview` (driven by router matches)
 *
 * Mount once under AuthProvider + Router (root component tree).
 */
import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

import { useAuth } from "@/hooks/useAuth";
import { applyResolvedAnalyticsIdentity, trackPageView } from "@/lib/analytics";
import { deriveRouteTemplateFromMatches } from "@/platform/analytics/route-template";
import { auth } from "@/lib/auth";

/**
 * Keep PostHog identify/reset aligned with the canonical resolved session.
 * Uses both the React Query auth observation (hard refresh) and auth.onChange
 * (logout / client session mutations) without provider-specific ownership.
 */
function useAnalyticsIdentityLifecycle(): void {
  const { user, isLoading, hydrated } = useAuth();

  // Primary path: server-validated auth query settles (hard refresh + OAuth/magic-link restore).
  useEffect(() => {
    if (isLoading || !hydrated) {
      // UNRESOLVED — do not treat as logout.
      return;
    }
    applyResolvedAnalyticsIdentity(user?.id ?? null);
  }, [user?.id, isLoading, hydrated, user]);

  // Secondary path: immediate client session transitions (signOut, password sign-in notify).
  // Planner dedupes USER A → USER A so dual observation is safe.
  useEffect(() => {
    const unsub = auth.onChange((nextUser) => {
      if (isLoading || !hydrated) return;
      applyResolvedAnalyticsIdentity(nextUser?.id ?? null);
    });
    return unsub;
  }, [isLoading, hydrated]);
}

/**
 * Emit exactly one `$pageview` per meaningful route template change.
 */
function useAnalyticsPageviews(): void {
  const matchKey = useRouterState({
    select: (s) => {
      const leaf = s.matches[s.matches.length - 1];
      // fullPath is the static template (e.g. /projects/$id/estimate), not the resolved UUID path.
      return leaf
        ? `${leaf.routeId}::${leaf.fullPath ?? ""}::${Boolean((s as { isNotFound?: boolean }).isNotFound)}`
        : `::__not_found__`;
    },
  });

  const isNotFound = useRouterState({
    select: (s) => Boolean((s as { isNotFound?: boolean }).isNotFound),
  });

  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (matchKey === lastKeyRef.current) return;
    lastKeyRef.current = matchKey;

    // Re-read matches inside effect via key change; snapshot from select above is stable enough
    // when matchKey changes. Reconstruct from matchKey components for purity:
    // matchKey format: routeId::fullPath::isNotFound
    const [routeId = "", fullPath = "", notFoundFlag = "false"] = matchKey.split("::");
    const template = deriveRouteTemplateFromMatches(
      [
        {
          routeId,
          // Prefer static fullPath template from TanStack match (contains `$id`, not UUIDs).
          fullPath: fullPath || undefined,
          pathname: undefined,
        },
      ],
      { isNotFound: notFoundFlag === "true" || isNotFound },
    );
    trackPageView(template);
  }, [matchKey, isNotFound]);
}

export function AnalyticsLifecycle(): null {
  useAnalyticsIdentityLifecycle();
  useAnalyticsPageviews();
  return null;
}
