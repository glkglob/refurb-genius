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
 * Emit exactly one `$pageview` per meaningful navigation.
 *
 * Public payload uses safe route_template only.
 * Local-only navigationKey uses resolved pathname (no search/hash) so
 * Project A → Project B emits two pageviews with the same template.
 * navigationKey is never sent to PostHog.
 */
function useAnalyticsPageviews(): void {
  const snapshot = useRouterState({
    select: (s) => {
      const leaf = s.matches[s.matches.length - 1];
      const isNotFound = Boolean((s as { isNotFound?: boolean }).isNotFound);
      // Pathname only — never search params or hash (OAuth/token privacy).
      const pathname = s.location?.pathname ?? "";
      return {
        routeId: leaf?.routeId ?? "",
        fullPath: leaf?.fullPath ?? "",
        pathname,
        isNotFound,
      };
    },
  });

  const lastNavKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Local-only key: changes for resource A → B; stable across pure rerenders.
    const navigationKey = snapshot.isNotFound ? "__not_found__" : snapshot.pathname || "__empty__";

    if (navigationKey === lastNavKeyRef.current) return;
    lastNavKeyRef.current = navigationKey;

    const template = deriveRouteTemplateFromMatches(
      [
        {
          routeId: snapshot.routeId,
          // Prefer static fullPath template from TanStack match (contains `$id`, not UUIDs).
          fullPath: snapshot.fullPath || undefined,
          // Fallback only: redacted if UUID path slips through as routeId.
          pathname: snapshot.pathname || undefined,
        },
      ],
      { isNotFound: snapshot.isNotFound },
    );

    trackPageView(template, { navigationKey });
  }, [snapshot.routeId, snapshot.fullPath, snapshot.pathname, snapshot.isNotFound]);
}

export function AnalyticsLifecycle(): null {
  useAnalyticsIdentityLifecycle();
  useAnalyticsPageviews();
  return null;
}
