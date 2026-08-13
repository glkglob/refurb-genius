/**
 * Platform HTTP boundary — native authenticated transport (IOS-READINESS-2C-1).
 *
 * Client-safe exports only. Server Bearer/CORS handlers live in `*.server.ts`
 * and are reached from `src/server.ts` via dynamic import.
 */
export { NativeHttpError, type NativeHttpErrorCode } from "./errors";
export { joinProductionApiUrl, normalizeHttpsOrigin, resolveProductionApiOrigin } from "./origin";
export {
  getNativeAccessToken,
  tryGetNativeAccessToken,
  resolveNativeAccessTokenFromAuth,
  isExpiredOrNearExpiry,
  NATIVE_TOKEN_EXPIRY_SKEW_SECONDS,
  type NativeAccessTokenResult,
  type NativeAccessTokenFailureReason,
} from "./native-access-token";
export {
  nativeAuthenticatedFetch,
  nativeAuthenticatedJson,
  type NativeAuthenticatedFetchInit,
} from "./native-authenticated-fetch";
export {
  MOBILE_API_PREFIX,
  MOBILE_SESSION_PING_PATH,
  pingNativeMobileSession,
} from "./mobile-session-ping";
