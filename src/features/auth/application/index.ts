/**
 * Auth feature application surface (AO-1F1 callback orchestration + 2B-3 native).
 */
export {
  completeAuthCallback,
  type CompleteAuthCallbackInput,
  type AuthCallbackCompletionResult,
} from "./completeAuthCallback";
export { resolveAuthCallbackDestination } from "./resolveAuthCallbackDestination";
export { mapNativeSupabaseUser } from "./mapNativeSupabaseUser";
export {
  mapNativeOAuthFailure,
  NATIVE_OAUTH_GENERIC_FAILURE_MESSAGE,
  NATIVE_OAUTH_INVALID_OR_EXPIRED_MESSAGE,
  NATIVE_OAUTH_PKCE_FAILURE_MESSAGE,
} from "./mapNativeOAuthFailure";
export {
  completeNativeOAuthSignIn,
  type CompleteNativeOAuthSignInInput,
  type NativeOAuthCompletionResult,
} from "./completeNativeOAuthSignIn";
