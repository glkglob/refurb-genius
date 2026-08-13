/**
 * Client helper for the authenticated mobile session canary (IOS-READINESS-2C-1).
 */
import { nativeAuthenticatedJson } from "./native-authenticated-fetch";

export const MOBILE_API_PREFIX = "/api/mobile/v1" as const;
export const MOBILE_SESSION_PING_PATH = `${MOBILE_API_PREFIX}/session/ping` as const;

export type MobileSessionPingResponse = {
  authenticated: true;
};

/** POST canary: proves Bearer transport without returning secrets. */
export async function pingNativeMobileSession(): Promise<MobileSessionPingResponse> {
  return nativeAuthenticatedJson<MobileSessionPingResponse>(MOBILE_SESSION_PING_PATH, {
    method: "POST",
    json: {},
  });
}
