/**
 * Apple Sign In (browser JS SDK) configuration helpers.
 *
 * Used by the root shell/head integration (src/routes/__root.tsx).
 * The Apple ID JS SDK requires a non-empty client ID in meta tags. When
 * VITE_APPLE_CLIENT_ID is missing/empty/whitespace, the app must not emit
 * Apple Sign In meta or load appleid.auth.js — otherwise the SDK throws
 * `The "clientId" should be a string.` on every document load.
 *
 * Separate from Supabase OAuth provider "apple", which does not depend on
 * the Apple browser SDK script.
 */

export const APPLE_SIGN_IN_SDK_URL =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

/** Trim and normalize a raw env value into a client ID string. */
export function resolveAppleClientId(raw: string | undefined | null): string {
  return raw?.trim() ?? "";
}

/** True when a non-empty Apple Services ID is available for the browser SDK. */
export function isAppleSignInConfigured(clientId: string): boolean {
  return clientId.length > 0;
}

export type AppleSignInMeta = { name: string; content: string };

/**
 * Head meta required by the Apple Sign In JS SDK.
 * Returns an empty array when client ID is not configured (do not emit empty client-id meta).
 */
export function buildAppleSignInHeadMeta(clientId: string, siteUrl: string): AppleSignInMeta[] {
  const id = resolveAppleClientId(clientId);
  if (!isAppleSignInConfigured(id)) {
    return [];
  }

  return [
    { name: "appleid-signin-client-id", content: id },
    { name: "appleid-signin-scope", content: "name email" },
    { name: "appleid-signin-redirect-uri", content: `${siteUrl}/auth/callback` },
    { name: "appleid-signin-use-popup", content: "true" },
  ];
}
