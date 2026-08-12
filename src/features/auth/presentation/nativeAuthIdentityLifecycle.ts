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
 */
export async function signOutNativeAuthIdentityFromBoundClient(): Promise<void> {
  if (!boundNativeAuthQueryClient) {
    // Still clear Keychain; cache isolation requires a bound client (AuthProvider).
    await signOutNativeSession();
    return;
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
