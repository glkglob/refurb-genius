/**
 * JS bridge for the first-party iOS ASWebAuthenticationSession plugin.
 *
 * IOS-READINESS-2B-1: registration + types only.
 * No OAuth initiation, PKCE, exchange, or session ownership.
 */
import { registerPlugin } from "@capacitor/core";

export type OpenAuthSessionOptions = {
  /** Absolute HTTPS URL to open in ASWebAuthenticationSession. */
  url: string;
  /**
   * Callback URL scheme (no `://`). Frozen production value:
   * `com.refurbgenius.app`
   */
  callbackScheme: string;
};

export type OpenAuthSessionResult =
  | { type: "success"; url: string }
  | { type: "cancel" };

export interface WebAuthSessionPlugin {
  openAuthSession(options: OpenAuthSessionOptions): Promise<OpenAuthSessionResult>;
}

/** Capacitor plugin name must match native `jsName` (`WebAuthSession`). */
export const WebAuthSession = registerPlugin<WebAuthSessionPlugin>("WebAuthSession");

/** Frozen OAuth return scheme for ASWebAuthenticationSession (2B contract). */
export const NATIVE_OAUTH_CALLBACK_SCHEME = "com.refurbgenius.app";

/**
 * Open a system auth session. Callers supply the already-built authorize URL.
 * Deferred to 2B-2+: actual signInWithOAuth / skipBrowserRedirect wiring.
 */
export function openNativeAuthSession(url: string): Promise<OpenAuthSessionResult> {
  return WebAuthSession.openAuthSession({
    url,
    callbackScheme: NATIVE_OAUTH_CALLBACK_SCHEME,
  });
}
