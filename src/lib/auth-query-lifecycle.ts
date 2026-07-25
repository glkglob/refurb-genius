/**
 * C4c-4 — Auth / React Query cache lifecycle helpers.
 *
 * Isolates non-auth React Query data when the observed authenticated identity
 * crosses a user boundary (user A → null, user A → user B).
 *
 * Does NOT wipe the entire query client (auth + mutation caches) indiscriminately.
 * Prefer cancel + remove with an exact auth-key exclusion.
 */

import type { QueryClient, QueryKey } from "@tanstack/react-query";

/** Must match AUTH_USER_QUERY_KEY in src/hooks/useAuth.ts. */
export const AUTH_USER_QUERY_KEY_SEGMENTS = ["auth", "currentUser"] as const;

/** Previous identity not yet established (first observation is non-destructive). */
export const UNRESOLVED_AUTH_IDENTITY = "unresolved" as const;

export type PreviousAuthIdentity = typeof UNRESOLVED_AUTH_IDENTITY | string | null;

/** Minimal user shape for identity comparison (id only). */
export type AuthLifecycleUser = { id: string } | null;

export type AuthTransitionResult = {
  nextPreviousIdentity: string | null;
  boundaryApplied: boolean;
};

/**
 * Exact canonical auth query key recognition (structural; not array reference).
 * Only ["auth", "currentUser"] is preserved — longer/shorter auth-prefixed keys
 * are treated as non-auth and purged on identity boundaries.
 */
export function isAuthUserQueryKey(queryKey: QueryKey): boolean {
  return (
    Array.isArray(queryKey) &&
    queryKey.length === AUTH_USER_QUERY_KEY_SEGMENTS.length &&
    queryKey[0] === AUTH_USER_QUERY_KEY_SEGMENTS[0] &&
    queryKey[1] === AUTH_USER_QUERY_KEY_SEGMENTS[1]
  );
}

/** Stable identity id from a user (or null when signed out). */
export function getAuthIdentity(user: AuthLifecycleUser): string | null {
  return user?.id ?? null;
}

/**
 * Whether previous → next crosses a user identity boundary requiring isolation.
 * - First observation (unresolved) is never a boundary.
 * - null → user is session establishment (not a cross-user boundary by default).
 * - user A → null and user A → user B are boundaries.
 */
export function isAuthIdentityBoundary(
  previousIdentity: PreviousAuthIdentity,
  nextUser: AuthLifecycleUser,
): boolean {
  if (previousIdentity === UNRESOLVED_AUTH_IDENTITY) return false;
  const nextId = getAuthIdentity(nextUser);
  // Signed-out → signed-in: establish session without purging (nothing to isolate
  // from a prior authenticated identity under the default rule).
  if (previousIdentity === null && nextId !== null) return false;
  return previousIdentity !== nextId;
}

/**
 * Apply an observed auth transition to the QueryClient.
 *
 * Order on boundary:
 *   1. await cancelQueries (non-auth predicate)
 *   2. removeQueries (non-auth predicate)
 *   3. setQueryData(AUTH, nextUser)
 *
 * Non-boundary: set auth query only; no cancel/remove.
 */
export async function applyAuthQueryCacheTransition(
  queryClient: QueryClient,
  previousIdentity: PreviousAuthIdentity,
  nextUser: AuthLifecycleUser,
): Promise<AuthTransitionResult> {
  const nextId = getAuthIdentity(nextUser);
  const boundary = isAuthIdentityBoundary(previousIdentity, nextUser);

  if (!boundary) {
    queryClient.setQueryData([...AUTH_USER_QUERY_KEY_SEGMENTS] as unknown as QueryKey, nextUser);
    return {
      nextPreviousIdentity: nextId,
      boundaryApplied: false,
    };
  }

  const nonAuthPredicate = (query: { queryKey: QueryKey }) => !isAuthUserQueryKey(query.queryKey);

  await queryClient.cancelQueries({ predicate: nonAuthPredicate });
  queryClient.removeQueries({ predicate: nonAuthPredicate });
  queryClient.setQueryData([...AUTH_USER_QUERY_KEY_SEGMENTS] as unknown as QueryKey, nextUser);

  return {
    nextPreviousIdentity: nextId,
    boundaryApplied: true,
  };
}
