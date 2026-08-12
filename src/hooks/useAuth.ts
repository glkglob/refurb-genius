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
 *   • The auth query is primed for the whole app lifetime (web).
 *   • The legacy `auth` listener ↔ Query cache bridge is active on **web only**.
 *   • Native identity uses Keychain-backed getNativeSupabase via the 2B-4
 *     serialized lifecycle (controller is the sole native AUTH publisher).
 *   • `useAuth()` can be called safely from **any** route (public or protected)
 *     and will gracefully return `{ user: null, isLoading: true, ... }` until
 *     the identity check completes.
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
 * - `src/lib/auth.ts` remains the low-level **web** client mutation layer
 *   (signIn / signUp / signOut / password flows / legacy listeners / direct
 *   Supabase browser client). Native does not subscribe to its onChange bridge.
 * - `src/serverFns/auth.ts` is the cookie authority for **web** SSR/client reads.
 * - Native reads use dynamic import of `@/platform/supabase/native` only inside
 *   infrastructure/lifecycle (no static SecureStorage graph on web SSR).
 */

import { useEffect, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getCurrentUserServerFn } from "@/serverFns/auth";
import type { AuthUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getAuthIdentityTransitionController } from "@/lib/auth-query-lifecycle";

/**
 * Lazy native lifecycle via the auth slice public barrel (presentation
 * re-exports). Dynamic import avoids static cycle with presentation hooks
 * that import AUTH_USER_QUERY_KEY from this module.
 */
async function loadNativeAuthLifecycle() {
  return import("@/features/auth");
}

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
   * Web: convenience wrapper around the legacy `auth.signOut()`.
   * Native: local Keychain sign-out + serialized A→null isolation (2B-4).
   * Isolation of non-auth query cache is owned by the lifecycle controller,
   * not by shell chrome.
   *
   * @deprecated You can also import { auth } from "@/lib/auth" directly when
   * the hook is not already in scope (e.g. inside event handlers in Sidebar).
   */
  signOut: () => Promise<void>;
}

/**
 * The primary React hook for reading authentication state.
 *
 * Always safe to call in any component (protected or public). On web it
 * fetches via cookie serverFn; on native it observes the Keychain-backed
 * session via the 2B-4 lifecycle (canonical query is observer-only).
 *
 * Note: identity-boundary cache isolation is mounted only in AuthProvider
 * (single coordinator). Consumer calls to useAuth() do not install additional
 * lifecycle listeners. On native, the browser auth listener bridge is not installed.
 */
export function useAuth(): UseAuthResult {
  // `useServerFn` wraps the `createServerFn` so it is callable from client
  // components while still executing its handler on the server (where cookies
  // are available via the request context). The returned function is stable.
  // Native never invokes this function for identity.
  const getCurrentUser = useServerFn(getCurrentUserServerFn);
  const queryClient = useQueryClient();
  const isNative = Capacitor.isNativePlatform();
  // Shared per-QC settlement drives native loading — not local observe races.
  // Completes even when observation is indeterminate (no false null publish).
  const [nativeSettled, setNativeSettled] = useState(false);

  useEffect(() => {
    if (!isNative) return;
    let alive = true;
    void (async () => {
      try {
        const { ensureNativeAuthIdentitySettled } = await loadNativeAuthLifecycle();
        await ensureNativeAuthIdentitySettled(queryClient);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          logger.warn("[useAuth] native settlement failed", { error: String(err) });
        }
      } finally {
        if (alive) setNativeSettled(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isNative, queryClient]);

  const query = useQuery<AuthUser | null, Error>({
    queryKey: AUTH_USER_QUERY_KEY,
    // Native: observer-only. Controller is the sole AUTH publisher.
    // Prevents React Query late-success from overwriting a later transition.
    enabled: !isNative,
    queryFn: async () => {
      if (Capacitor.isNativePlatform()) {
        throw new Error("Native auth identity must not fetch via React Query.");
      }

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
    // Web only — native uses shared settlement + appStateChange.
    refetchOnMount: !isNative,
    refetchOnWindowFocus: !isNative,
    // One retry is plenty for an idempotent read; keeps UI responsive on flakes.
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });

  const { data, isLoading: webIsLoading, refetch: rqRefetch } = query;

  // Native loading = shared settlement incomplete (not "data === undefined" alone).
  // AUTH undefined after settle means unresolved/indeterminate without false null.
  // AUTH null = authoritative signed-out; user object = authenticated.
  const isLoading = isNative ? !nativeSettled : webIsLoading;
  const user = (data ?? null) as AuthUser | null;
  const isAuthenticated = Boolean(user);
  const hydrated = isNative ? nativeSettled : !webIsLoading;

  const refetch = async (): Promise<AuthUser | null> => {
    if (Capacitor.isNativePlatform()) {
      const { observeNativeAuthIdentity } = await loadNativeAuthLifecycle();
      const outcome = await observeNativeAuthIdentity(queryClient);
      if (outcome.kind === "authenticated") return outcome.user;
      if (outcome.kind === "signed-out") return null;
      // Indeterminate: retain last successful identity if any.
      const cached = queryClient.getQueryData<AuthUser | null>(AUTH_USER_QUERY_KEY);
      return cached ?? null;
    }
    const result = await rqRefetch();
    return (result.data ?? null) as AuthUser | null;
  };

  // Isolation is owned by the per-QC controller (web onChange / native lifecycle).
  // Do not setQueryData(null) here — that would bypass cancel/remove.
  const signOut = async (): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      const { signOutNativeAuthIdentity } = await loadNativeAuthLifecycle();
      await signOutNativeAuthIdentity(queryClient);
      return;
    }
    const { auth } = await import("@/lib/auth");
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
 * C4c-4 / 2B-4: single app-lifetime auth/query-cache lifecycle bridge.
 *
 * Mounted only from AuthProvider so there is exactly one previous-identity
 * tracker (per QueryClient controller) and one serialized transition chain.
 * Consumer useAuth() calls must not install additional isolation handlers.
 *
 * Web: auth.onChange → controller.commitKnown
 * Native: bind QC + shared initial settlement + single appStateChange (no browser onChange)
 */
function useAuthQueryCacheLifecycleBridge(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let disposed = false;
    let unbind: (() => void) | undefined;
    let removeAppListener: (() => void) | undefined;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const {
        bindNativeAuthIdentityQueryClient,
        ensureNativeAuthIdentitySettled,
        observeNativeAuthIdentity,
      } = await loadNativeAuthLifecycle();
      if (disposed) return;

      // Bind QC for shell useSignOut native path (no useQueryClient in that hook).
      unbind = bindNativeAuthIdentityQueryClient(queryClient);

      if (Capacitor.isNativePlatform()) {
        try {
          // Shared per-QC flight — same promise as concurrent useAuth consumers.
          await ensureNativeAuthIdentitySettled(queryClient);
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            logger.warn("[useAuth] native initial settlement failed", { error: String(err) });
          }
        }
        if (disposed) return;

        try {
          const { App } = await import("@capacitor/app");
          const handle = await App.addListener("appStateChange", (state) => {
            if (!state.isActive || disposed) return;
            void observeNativeAuthIdentity(queryClient).catch((err) => {
              if (process.env.NODE_ENV !== "production") {
                logger.warn("[useAuth] native resume observe failed", { error: String(err) });
              }
            });
          });
          if (disposed) {
            void handle.remove();
            return;
          }
          removeAppListener = () => {
            void handle.remove();
          };
        } catch {
          // @capacitor/app may be unavailable in unit tests — restore still ran.
        }
        return;
      }

      // Web: browser auth.onChange → controller.commitKnown
      const controller = getAuthIdentityTransitionController(queryClient);
      const { auth } = await import("@/lib/auth");
      if (disposed) return;
      unsubscribe = auth.onChange((newUser) => {
        void controller.commitKnown(newUser).catch((err) => {
          if (process.env.NODE_ENV !== "production") {
            logger.warn("[useAuth] auth cache transition failed", { error: String(err) });
          }
        });
      });
    })();

    return () => {
      disposed = true;
      removeAppListener?.();
      unsubscribe?.();
      unbind?.();
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
 * The initial web load performs a cookie-based server check (via
 * `getCurrentUserServerFn`) so the value survives hard refresh / direct nav.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Prime the auth query for the app lifetime (web fetch / native cache observe).
  useAuth();
  // Exactly one lifecycle coordinator (must not live inside every useAuth call).
  useAuthQueryCacheLifecycleBridge();
  return children;
}
