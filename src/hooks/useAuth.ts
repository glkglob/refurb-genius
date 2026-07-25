/**
 * Production-grade `useAuth()` hook powering authenticated UI across the app.
 *
 * This implementation replaces the fragile client-only singleton pattern
 * (previous src/hooks/useAuth.ts + src/lib/auth.ts in-memory state) with a
 * robust TanStack Query + `useServerFn` approach.
 *
 * Key benefits:
 * - Survives hard refreshes, direct URL navigation, and initial SSR renders
 *   because `getCurrentUserServerFn` reads auth cookies on the server.
 * - Eliminates the "hydrated but null → instant redirect" race that the old
 *   hydration-timeout + listener logic only partially solved.
 * - Provides first-class caching (`staleTime` / `gcTime`), background updates,
 *   `refetch`, and easy invalidation for post-login / post-serverFn flows.
 * - Full TypeScript, detailed JSDoc, graceful error handling.
 *
 * ## AuthProvider
 *
 * In addition to the `useAuth()` hook, this module exports `<AuthProvider>`.
 * Wrap the application **once** in `src/routes/__root.tsx` (inside
 * QueryClientProvider, around ThemeProvider + Outlet). This guarantees:
 *   • The auth query is primed for the whole app lifetime.
 *   • The legacy `auth` listener ↔ Query cache bridge is always active.
 *   • `useAuth()` can be called safely from **any** route (public or protected)
 *     and will gracefully return `{ user: null, isLoading: true, ... }` until
 *     the server-validated check completes.
 *
 * Backward compatibility:
 * - The returned object still includes the legacy `hydrated` and `signOut`
 *   properties so that existing call sites (RequireAuth, routes, hooks, Sidebar,
 *   settings, useRole, etc.) continue to work without immediate changes.
 * - `AuthUser` type is re-exported from the same location (`@/lib/auth`).
 *
 * Invalidation support:
 * - Import `AUTH_USER_QUERY_KEY` and call `queryClient.invalidateQueries({ queryKey })`
 *   after any serverFn or client mutation that may have changed auth state.
 *
 * Relationship to other auth modules:
 * - `src/lib/auth.ts` remains the low-level client mutation layer
 *   (signIn / signUp / signOut / password flows / legacy listeners / direct
 *   Supabase browser client). It is intentionally kept as-is for this phase.
 * - `src/serverFns/auth.ts` (Agent 1) is the single source of truth for
 *   *reading* the user inside any `createServerFn` (and now, via this hook,
 *   for React UI as well).
 *
 * Future work (outside this task):
 * - Protected serverFns already use `requireUser()` / `getCurrentUserServerFn`.
 * - Login flows in /auth may later be augmented to invalidate this key on success.
 * - Direct `auth.getUser()` calls in non-React code (stores etc.) can stay or
 *   gradually migrate to serverFn calls.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getCurrentUserServerFn } from "@/serverFns/auth";
import { auth, type AuthUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  UNRESOLVED_AUTH_IDENTITY,
  applyAuthQueryCacheTransition,
  type PreviousAuthIdentity,
} from "@/lib/auth-query-lifecycle";

/**
 * Canonical query key for the current authenticated user.
 *
 * Use this when you need to manually invalidate or update the auth cache
 * from mutation success handlers, login callbacks, or after serverFn calls
 * that may have altered session state.
 *
 * Example:
 *   import { useQueryClient } from '@tanstack/react-query';
 *   import { AUTH_USER_QUERY_KEY } from '@/hooks/useAuth';
 *   ...
 *   const qc = useQueryClient();
 *   await qc.invalidateQueries({ queryKey: AUTH_USER_QUERY_KEY });
 */
export const AUTH_USER_QUERY_KEY = ["auth", "currentUser"] as const;

/**
 * Shape returned by `useAuth()`.
 * Legacy fields (`hydrated`, `signOut`) are provided for zero-friction migration.
 */
export interface UseAuthResult {
  /** Currently authenticated user (or null when signed out or still loading). */
  user: AuthUser | null;
  /** True during the *initial* fetch (including after hard refresh / direct nav). */
  isLoading: boolean;
  /** `true` when a non-null user is present. */
  isAuthenticated: boolean;
  /**
   * Manually refetch the current user from the server (cookie-validated).
   * Returns the user (or null) when the refetch settles.
   */
  refetch: () => Promise<AuthUser | null>;

  // ──────────────────────────────────────────────────────────────────────────
  // Legacy compatibility fields (safe to use during the transition period)
  // These will be removed in a future cleanup once all consumers are updated.
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * @deprecated Use `isLoading` (negated) instead.
   * True once the first auth check from the server has completed (success or failure).
   * Mirrors the old "hydrated" flag that guards used to wait for.
   */
  hydrated: boolean;

  /**
   * Convenience wrapper around the legacy `auth.signOut()`.
   * Isolation of non-auth query cache is owned by the root AuthProvider
   * lifecycle bridge (C4c-4), not by this wrapper.
   *
   * @deprecated You can also import { auth } from "@/lib/auth" directly when
   * the hook is not already in scope (e.g. inside event handlers in Sidebar).
   */
  signOut: () => Promise<void>;
}

/**
 * The primary React hook for reading authentication state.
 *
 * Always safe to call in any component (protected or public). It will
 * automatically fetch the user via a server round-trip on first mount
 * (or when cache is stale) using only cookie data — therefore it works
 * correctly even on a hard browser refresh of a deep-linked protected page.
 *
 * Note: identity-boundary cache isolation is mounted only in AuthProvider
 * (single coordinator). Consumer calls to useAuth() do not install additional
 * lifecycle listeners.
 */
export function useAuth(): UseAuthResult {
  const queryClient = useQueryClient();

  // `useServerFn` wraps the `createServerFn` so it is callable from client
  // components while still executing its handler on the server (where cookies
  // are available via the request context). The returned function is stable.
  const getCurrentUser = useServerFn(getCurrentUserServerFn);

  const query = useQuery<AuthUser | null, Error>({
    queryKey: AUTH_USER_QUERY_KEY,
    queryFn: async () => {
      try {
        // Call with no payload — the serverFn accepts the empty object schema.
        const { user } = await getCurrentUser();
        return user;
      } catch (err) {
        // Treat any failure to read the session (network, misconfigured JWT,
        // expired cookie, etc.) as "not authenticated" for the current render.
        // The error is swallowed so that UI never crashes; callers can still
        // use `refetch()` to retry, and Sentry breadcrumbs from the serverFn
        // layer will have captured details.
        // In a stricter app you might surface a toast on persistent errors.
        if (process.env.NODE_ENV !== "production") {
          logger.warn("[useAuth] getCurrentUserServerFn error (treated as signed-out)", {
            error: String(err),
          });
        }
        return null;
      }
    },
    // 5 minutes of freshness is a good default for an auth session check.
    // Users rarely sign out/in more frequently, and we still refetch on focus/mount
    // when outside the window.
    staleTime: 5 * 60 * 1000,
    // Retain data for 10 minutes before React Query garbage-collects it.
    gcTime: 10 * 60 * 1000,
    // Always attempt a background check on mount so hard-refreshes and
    // tab restores get the freshest cookie-derived user.
    refetchOnMount: true,
    // If the user signs in on another tab or via OAuth redirect, we pick it up.
    refetchOnWindowFocus: true,
    // One retry is plenty for an idempotent read; keeps UI responsive on flakes.
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });

  const { data, isLoading, refetch: rqRefetch } = query;

  // Normalised refetch that returns just the user (or null) for convenience.
  const refetch = async (): Promise<AuthUser | null> => {
    const result = await rqRefetch();
    // result.data is AuthUser | null | undefined
    return (result.data ?? null) as AuthUser | null;
  };

  const user = (data ?? null) as AuthUser | null;
  const isAuthenticated = Boolean(user);
  const hydrated = !isLoading;

  // Isolation is owned by AuthProvider's single lifecycle bridge.
  // Do not setQueryData(null) here — that would bypass cancel/remove.
  const signOut = async (): Promise<void> => {
    await auth.signOut();
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    refetch,
    hydrated,
    signOut,
  };
}

/**
 * C4c-4: single app-lifetime auth/query-cache lifecycle bridge.
 *
 * Mounted only from AuthProvider so there is exactly one previous-identity
 * tracker and one serialized transition chain. Consumer useAuth() calls must
 * not install additional onChange isolation handlers.
 */
function useAuthQueryCacheLifecycleBridge(): void {
  const queryClient = useQueryClient();
  const previousIdentityRef = useRef<PreviousAuthIdentity>(UNRESOLVED_AUTH_IDENTITY);
  const transitionChainRef = useRef(Promise.resolve());

  useEffect(() => {
    let disposed = false;

    const unsubscribe = auth.onChange((newUser) => {
      transitionChainRef.current = transitionChainRef.current
        .then(async () => {
          if (disposed) return;
          const result = await applyAuthQueryCacheTransition(
            queryClient,
            previousIdentityRef.current,
            newUser,
          );
          if (!disposed) {
            previousIdentityRef.current = result.nextPreviousIdentity;
          }
        })
        .catch((err) => {
          if (process.env.NODE_ENV !== "production") {
            logger.warn("[useAuth] auth cache transition failed", { error: String(err) });
          }
        });
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [queryClient]);
}

/**
 * Root-level Auth provider.
 *
 * Primes the auth query and installs the **single** auth/query-cache lifecycle
 * bridge for the application lifetime.
 *
 * Must be rendered **inside** a `<QueryClientProvider>` (it calls
 * `useQueryClient()` and `useQuery` via the hook).
 *
 * Recommended tree (see src/routes/__root.tsx):
 *
 *   <QueryClientProvider client={queryClient}>
 *     <AuthProvider>
 *       <ThemeProvider>
 *         <RootErrorBoundary>
 *           <Outlet />
 *         </RootErrorBoundary>
 *         <Toaster />
 *       </ThemeProvider>
 *     </AuthProvider>
 *   </QueryClientProvider>
 *
 * After this wrapper exists, any component — even on completely public routes
 * such as `/`, `/auth`, `/trades`, `/privacy` — can call `useAuth()` and will
 * receive a stable object with `user: null | AuthUser`, `isLoading`, etc.
 * The initial load performs a cookie-based server check (via
 * `getCurrentUserServerFn`) so the value survives hard refresh / direct nav.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Prime the auth query for the app lifetime.
  useAuth();
  // Exactly one lifecycle coordinator (must not live inside every useAuth call).
  useAuthQueryCacheLifecycleBridge();
  return children;
}
