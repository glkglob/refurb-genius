/**
 * Native auth identity lifecycle orchestration (IOS-READINESS-2B-4).
 *
 * Composes infrastructure session ops with the per-QueryClient transition
 * controller. Owns QueryClient effects for native only; does not own
 * navigation, toasts, or business authorization.
 *
 * Shell useSignOut must not call useQueryClient (shell-auth-signout-ownership).
 * AuthProvider binds the app QueryClient so shell sign-out can still run the
 * serialized local sign-out + A→null transition without holding QC itself.
 *
 * Initial settlement is shared per QueryClient so multiple useAuth consumers
 * converge on one observe flight and cannot disagree about loading completion.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { AuthUser } from "@/lib/auth";
import { getAuthIdentityTransitionController } from "@/lib/auth-query-lifecycle";
import {
  completeNativeOAuthSignIn,
  type CompleteNativeOAuthSignInInput,
} from "../application/completeNativeOAuthSignIn";
import {
  readNativeAuthSession,
  type NativeAuthSessionOutcome,
} from "../infrastructure/readNativeAuthSession";
import { signOutNativeSession } from "../infrastructure/signOutNativeSession";

export type { NativeAuthSessionOutcome };

/** App QueryClient bound by AuthProvider for shell native sign-out. */
let boundNativeAuthQueryClient: QueryClient | null = null;

type NativeSettlementEntry = {
  promise: Promise<NativeAuthSessionOutcome | undefined>;
  settled: boolean;
};

/** One shared initial-settlement flight per QueryClient (not per hook instance). */
const nativeSettlements = new WeakMap<QueryClient, NativeSettlementEntry>();

/**
 * Bind the application QueryClient for native lifecycle helpers used outside
 * React hooks that cannot hold useQueryClient (e.g. useSignOut shell path).
 * Returns unbind for dispose.
 */
export function bindNativeAuthIdentityQueryClient(queryClient: QueryClient): () => void {
  boundNativeAuthQueryClient = queryClient;
  return () => {
    if (boundNativeAuthQueryClient === queryClient) {
      boundNativeAuthQueryClient = null;
    }
  };
}

/** Whether the shared initial native observe for this QueryClient has finished. */
export function isNativeAuthIdentitySettled(queryClient: QueryClient): boolean {
  return nativeSettlements.get(queryClient)?.settled === true;
}

/**
 * Ensure a single shared initial observation has completed for this QueryClient.
 *
 * - Concurrent callers share one promise.
 * - Authoritative outcomes still publish via the controller.
 * - Indeterminate / rejected observe never auto-commits signed-out, but
 *   settlement still completes so UI cannot hang in permanent loading.
 */
export function ensureNativeAuthIdentitySettled(
  queryClient: QueryClient,
): Promise<NativeAuthSessionOutcome | undefined> {
  const existing = nativeSettlements.get(queryClient);
  if (existing) {
    return existing.promise;
  }

  const entry: NativeSettlementEntry = {
    settled: false,
    promise: Promise.resolve(undefined),
  };

  entry.promise = (async () => {
    try {
      return await observeNativeAuthIdentity(queryClient);
    } catch {
      // Rejected observation: leave AUTH cache unchanged; still mark settled.
      return undefined;
    } finally {
      entry.settled = true;
    }
  })();

  nativeSettlements.set(queryClient, entry);
  return entry.promise;
}

/**
 * Serialized native session observation: read inside the controller chain,
 * then publish authoritative authenticated/signed-out outcomes only.
 */
export async function observeNativeAuthIdentity(
  queryClient: QueryClient,
): Promise<NativeAuthSessionOutcome> {
  const controller = getAuthIdentityTransitionController(queryClient);
  const outcome = await controller.observe(() => readNativeAuthSession());
  // Controller observation shape is id-minimal; native read returns AuthUser.
  return outcome as NativeAuthSessionOutcome;
}

/**
 * Local native sign-out + A→null isolation in one serialized operation.
 * If storage clear fails, does not publish null.
 * Order: clear Keychain, then purge non-auth, then publish null.
 */
export async function signOutNativeAuthIdentity(queryClient: QueryClient): Promise<void> {
  const controller = getAuthIdentityTransitionController(queryClient);
  await controller.runSerialized(async ({ applyTransition }) => {
    await signOutNativeSession();
    await applyTransition(null);
  });
}

/**
 * Shell-safe native sign-out using the AuthProvider-bound QueryClient.
 * Does not require useQueryClient in useSignOut.
 *
 * Fail-closed when unbound: never clear Keychain without transition authority
 * (avoids storage/cache divergence).
 */
export async function signOutNativeAuthIdentityFromBoundClient(): Promise<void> {
  if (!boundNativeAuthQueryClient) {
    throw new Error(
      "Native sign-out requires AuthProvider-bound QueryClient transition authority.",
    );
  }
  await signOutNativeAuthIdentity(boundNativeAuthQueryClient);
}

/**
 * Complete native OAuth and publish the authenticated user inside the same
 * serialized chain as the exchange call.
 */
export async function completeAndPublishNativeOAuth(
  queryClient: QueryClient,
  input: CompleteNativeOAuthSignInInput,
): Promise<{ user: AuthUser; destination: string }> {
  const controller = getAuthIdentityTransitionController(queryClient);
  return controller.runSerialized(async ({ applyTransition }) => {
    const completion = await completeNativeOAuthSignIn(input);
    if (completion.kind === "error") {
      throw new Error(completion.message);
    }
    await applyTransition(completion.user);
    return { user: completion.user, destination: completion.destination };
  });
}
