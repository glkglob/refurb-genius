/**
 * C4c-4 — Auth / React Query cache lifecycle helpers.
 *
 * Isolates non-auth React Query data when the observed authenticated identity
 * crosses a user boundary (user A → null, user A → user B).
 *
 * Does NOT wipe the entire query client (auth + mutation caches) indiscriminately.
 * Prefer cancel + remove with an exact auth-key exclusion.
 *
 * IOS-READINESS-2B-4: per-QueryClient serialized transition controller is the
 * sole authority that publishes AUTH_USER_QUERY_KEY for native (and the web
 * onChange bridge). No Supabase/Capacitor ownership here.
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
 * Outcome of a serialized identity observation (read + optional transition).
 * Feature layers map platform-specific reads into this shape.
 */
export type AuthIdentityObservation =
  | { kind: "authenticated"; user: { id: string } }
  | { kind: "signed-out" }
  | { kind: "indeterminate" };

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

const AUTH_KEY = [...AUTH_USER_QUERY_KEY_SEGMENTS] as unknown as QueryKey;

function resolveInitialPrevious(queryClient: QueryClient): PreviousAuthIdentity {
  const data = queryClient.getQueryData(AUTH_KEY);
  if (data === undefined) return UNRESOLVED_AUTH_IDENTITY;
  if (data === null) return null;
  if (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    typeof (data as { id: unknown }).id === "string"
  ) {
    return (data as { id: string }).id;
  }
  return UNRESOLVED_AUTH_IDENTITY;
}

export type AuthIdentitySerializedApi = {
  applyTransition: (nextUser: AuthLifecycleUser) => Promise<AuthTransitionResult>;
};

/**
 * Per-QueryClient serialized identity transition authority.
 *
 * Sole publisher of AUTH_USER_QUERY_KEY when used for native (and web onChange).
 * Does not call Supabase or Capacitor.
 */
export class AuthIdentityTransitionController {
  private previous: PreviousAuthIdentity;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly queryClient: QueryClient) {
    this.previous = resolveInitialPrevious(queryClient);
  }

  /** Test/debug: current previous identity for this QC. */
  getPreviousIdentity(): PreviousAuthIdentity {
    return this.previous;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async applyTransition(nextUser: AuthLifecycleUser): Promise<AuthTransitionResult> {
    const result = await applyAuthQueryCacheTransition(this.queryClient, this.previous, nextUser);
    this.previous = result.nextPreviousIdentity;
    return result;
  }

  /**
   * Perform readFn inside the chain, then transition only for authoritative outcomes.
   */
  observe(readFn: () => Promise<AuthIdentityObservation>): Promise<AuthIdentityObservation> {
    return this.enqueue(async () => {
      const outcome = await readFn();
      if (outcome.kind === "authenticated") {
        await this.applyTransition(outcome.user);
      } else if (outcome.kind === "signed-out") {
        await this.applyTransition(null);
      }
      return outcome;
    });
  }

  /**
   * Publish a known authoritative identity (e.g. web onChange payload).
   * Prefer runSerialized when a session mutation must pair with the transition.
   */
  commitKnown(nextUser: AuthLifecycleUser): Promise<AuthTransitionResult> {
    return this.enqueue(() => this.applyTransition(nextUser));
  }

  /**
   * Run mutation + transition in one chain slot (no nested enqueue).
   * Used for OAuth exchange + publish and native local sign-out + publish.
   */
  runSerialized<T>(fn: (api: AuthIdentitySerializedApi) => Promise<T>): Promise<T> {
    return this.enqueue(() =>
      fn({
        applyTransition: (nextUser) => this.applyTransition(nextUser),
      }),
    );
  }
}

const controllers = new WeakMap<QueryClient, AuthIdentityTransitionController>();

/**
 * One controller per QueryClient. Different QueryClients never share state.
 */
export function getAuthIdentityTransitionController(
  queryClient: QueryClient,
): AuthIdentityTransitionController {
  let controller = controllers.get(queryClient);
  if (!controller) {
    controller = new AuthIdentityTransitionController(queryClient);
    controllers.set(queryClient, controller);
  }
  return controller;
}
