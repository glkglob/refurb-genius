import { describe, it, expect, vi } from "vitest";
import {
  isExpiredOrNearExpiry,
  resolveNativeAccessTokenFromAuth,
  NATIVE_TOKEN_EXPIRY_SKEW_SECONDS,
} from "./native-access-token";

function mockAuth(opts: {
  session?: { access_token?: string; expires_at?: number } | null;
  getError?: { message: string } | null;
  refreshSession?: { access_token?: string; expires_at?: number } | null;
  refreshError?: { message: string } | null;
  getThrows?: boolean;
  refreshThrows?: boolean;
}) {
  return {
    getSession: vi.fn(async () => {
      if (opts.getThrows) throw new Error("boom");
      return {
        data: { session: opts.session ?? null },
        error: opts.getError ?? null,
      };
    }),
    refreshSession: vi.fn(async () => {
      if (opts.refreshThrows) throw new Error("refresh boom");
      return {
        data: { session: opts.refreshSession ?? null },
        error: opts.refreshError ?? null,
      };
    }),
  };
}

describe("isExpiredOrNearExpiry", () => {
  const now = 1_700_000_000;

  it("treats missing expires_at as expired", () => {
    expect(isExpiredOrNearExpiry(undefined, now)).toBe(true);
    expect(isExpiredOrNearExpiry(null, now)).toBe(true);
  });

  it("respects skew window", () => {
    expect(isExpiredOrNearExpiry(now + NATIVE_TOKEN_EXPIRY_SKEW_SECONDS + 10, now)).toBe(false);
    expect(isExpiredOrNearExpiry(now + NATIVE_TOKEN_EXPIRY_SKEW_SECONDS, now)).toBe(true);
    expect(isExpiredOrNearExpiry(now - 1, now)).toBe(true);
  });
});

describe("resolveNativeAccessTokenFromAuth", () => {
  const now = 1_700_000_000;
  const farFuture = now + 3600;

  it("returns access token for valid non-expiring session", async () => {
    const auth = mockAuth({
      session: { access_token: "tok-valid", expires_at: farFuture },
    });
    const result = await resolveNativeAccessTokenFromAuth(auth, { nowSeconds: now });
    expect(result).toEqual({ ok: true, accessToken: "tok-valid" });
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it("returns signed_out when session missing", async () => {
    const auth = mockAuth({ session: null });
    await expect(resolveNativeAccessTokenFromAuth(auth, { nowSeconds: now })).resolves.toEqual({
      ok: false,
      reason: "signed_out",
    });
  });

  it("returns indeterminate on getSession error", async () => {
    const auth = mockAuth({ session: null, getError: { message: "storage" } });
    await expect(resolveNativeAccessTokenFromAuth(auth, { nowSeconds: now })).resolves.toEqual({
      ok: false,
      reason: "indeterminate",
    });
  });

  it("returns indeterminate when getSession throws", async () => {
    const auth = mockAuth({ getThrows: true });
    await expect(resolveNativeAccessTokenFromAuth(auth, { nowSeconds: now })).resolves.toEqual({
      ok: false,
      reason: "indeterminate",
    });
  });

  it("refreshes when expired and returns new token", async () => {
    const auth = mockAuth({
      session: { access_token: "tok-old", expires_at: now - 10 },
      refreshSession: { access_token: "tok-new", expires_at: farFuture },
    });
    const result = await resolveNativeAccessTokenFromAuth(auth, { nowSeconds: now });
    expect(result).toEqual({ ok: true, accessToken: "tok-new" });
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("returns refresh_failed when refresh fails", async () => {
    const auth = mockAuth({
      session: { access_token: "tok-old", expires_at: now - 10 },
      refreshError: { message: "invalid refresh" },
    });
    await expect(resolveNativeAccessTokenFromAuth(auth, { nowSeconds: now })).resolves.toEqual({
      ok: false,
      reason: "refresh_failed",
    });
  });

  it("forceRefresh always refreshes once", async () => {
    const auth = mockAuth({
      session: { access_token: "tok-old", expires_at: farFuture },
      refreshSession: { access_token: "tok-forced", expires_at: farFuture },
    });
    const result = await resolveNativeAccessTokenFromAuth(auth, {
      forceRefresh: true,
      nowSeconds: now,
    });
    expect(result).toEqual({ ok: true, accessToken: "tok-forced" });
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("never puts token values into failure reasons", async () => {
    const auth = mockAuth({
      session: { access_token: "super-secret-token", expires_at: now - 1 },
      refreshError: { message: "nope" },
    });
    const result = await resolveNativeAccessTokenFromAuth(auth, { nowSeconds: now });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(JSON.stringify(result)).not.toContain("super-secret-token");
    }
  });
});
