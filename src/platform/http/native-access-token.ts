/**
 * Canonical native access-token acquisition (IOS-READINESS-2C-1).
 *
 * Source: getNativeSupabase().auth.getSession() → session.access_token
 *
 * - Just-in-time only; never localStorage/cookies/secondary store
 * - Never log or return tokens via error messages
 * - autoRefreshToken remains false; explicit refresh at request time
 */
import { Capacitor } from "@capacitor/core";
import { NativeHttpError } from "./errors";

/** Refresh when fewer than this many seconds remain before expires_at. */
export const NATIVE_TOKEN_EXPIRY_SKEW_SECONDS = 60;

export type NativeAccessTokenFailureReason =
  | "signed_out"
  | "indeterminate"
  | "refresh_failed"
  | "not_native";

export type NativeAccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: NativeAccessTokenFailureReason };

type SessionLike = {
  access_token?: string;
  expires_at?: number;
};

type AuthClientLike = {
  getSession: () => Promise<{
    data: { session: SessionLike | null };
    error: { message?: string } | null;
  }>;
  refreshSession: () => Promise<{
    data: { session: SessionLike | null };
    error: { message?: string } | null;
  }>;
};

/** Exported for unit tests with synthetic clients. */
export function isExpiredOrNearExpiry(
  expiresAt: number | undefined | null,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  skewSeconds: number = NATIVE_TOKEN_EXPIRY_SKEW_SECONDS,
): boolean {
  if (expiresAt == null || !Number.isFinite(expiresAt)) return true;
  return expiresAt <= nowSeconds + skewSeconds;
}

/**
 * Resolve a usable access token from a session-capable auth client.
 * Pure orchestration over injected client — production uses getNativeSupabase().auth.
 */
export async function resolveNativeAccessTokenFromAuth(
  auth: AuthClientLike,
  options?: { forceRefresh?: boolean; nowSeconds?: number },
): Promise<NativeAccessTokenResult> {
  const forceRefresh = options?.forceRefresh === true;
  const nowSeconds = options?.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (forceRefresh) {
    return refreshOnce(auth);
  }

  let session: SessionLike | null;
  try {
    const {
      data: { session: current },
      error,
    } = await auth.getSession();
    if (error) return { ok: false, reason: "indeterminate" };
    session = current;
  } catch {
    return { ok: false, reason: "indeterminate" };
  }

  if (!session?.access_token) {
    return { ok: false, reason: "signed_out" };
  }

  if (isExpiredOrNearExpiry(session.expires_at, nowSeconds)) {
    return refreshOnce(auth);
  }

  return { ok: true, accessToken: session.access_token };
}

async function refreshOnce(auth: AuthClientLike): Promise<NativeAccessTokenResult> {
  try {
    const {
      data: { session },
      error,
    } = await auth.refreshSession();
    if (error || !session?.access_token) {
      return { ok: false, reason: "refresh_failed" };
    }
    return { ok: true, accessToken: session.access_token };
  } catch {
    return { ok: false, reason: "refresh_failed" };
  }
}

/**
 * Canonical production entry: read/refresh native Keychain-backed session access token.
 * Throws NativeHttpError when unavailable (never embeds token values).
 */
export async function getNativeAccessToken(options?: { forceRefresh?: boolean }): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    throw new NativeHttpError("Native access token is only available on native platforms", {
      code: "unauthorized",
    });
  }

  const { getNativeSupabase } = await import("@/platform/supabase/native");
  const result = await resolveNativeAccessTokenFromAuth(getNativeSupabase().auth, options);

  if (!result.ok) {
    const code =
      result.reason === "signed_out"
        ? "signed_out"
        : result.reason === "refresh_failed"
          ? "refresh_failed"
          : "indeterminate";
    throw new NativeHttpError(`Native access token unavailable (${result.reason})`, { code });
  }

  return result.accessToken;
}

/** Result-style API for callers that prefer not to throw. */
export async function tryGetNativeAccessToken(options?: {
  forceRefresh?: boolean;
}): Promise<NativeAccessTokenResult> {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, reason: "not_native" };
  }

  try {
    const { getNativeSupabase } = await import("@/platform/supabase/native");
    return resolveNativeAccessTokenFromAuth(getNativeSupabase().auth, options);
  } catch {
    return { ok: false, reason: "indeterminate" };
  }
}
