/**
 * Native OAuth initiation primitive contracts (IOS-READINESS-2B-2).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signInWithOAuth = vi.fn();
const getNativeSupabase = vi.fn();

vi.mock("@/platform/supabase/native", () => ({
  getNativeSupabase: () => getNativeSupabase(),
}));

import { startNativeOAuthSignIn } from "./startNativeOAuthSignIn";
import { AUTH_RETURN_CUSTOM_CALLBACK } from "@/platform/auth/native/auth-return";

const SRC = join(__dirname, "startNativeOAuthSignIn.ts");

beforeEach(() => {
  signInWithOAuth.mockReset();
  getNativeSupabase.mockReset();
  getNativeSupabase.mockReturnValue({
    auth: {
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
    },
  });
  signInWithOAuth.mockResolvedValue({
    data: {
      url: "https://example.supabase.co/auth/v1/authorize?provider=google",
      provider: "google",
    },
    error: null,
  });
});

describe("startNativeOAuthSignIn", () => {
  it.each(["google", "apple", "github"] as const)(
    "calls signInWithOAuth for %s with frozen custom callback and skipBrowserRedirect",
    async (provider) => {
      signInWithOAuth.mockResolvedValue({
        data: {
          url: `https://example.supabase.co/auth/v1/authorize?provider=${provider}`,
          provider,
        },
        error: null,
      });

      const result = await startNativeOAuthSignIn({ provider });

      expect(getNativeSupabase).toHaveBeenCalledTimes(1);
      expect(signInWithOAuth).toHaveBeenCalledTimes(1);
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider,
        options: {
          redirectTo: AUTH_RETURN_CUSTOM_CALLBACK,
          skipBrowserRedirect: true,
        },
      });
      expect(AUTH_RETURN_CUSTOM_CALLBACK).toBe("com.refurbgenius.app://auth/callback");
      expect(result.url).toMatch(/^https:\/\//);
    },
  );

  it("omits queryParams entirely (no native queryParams.redirect_to)", async () => {
    await startNativeOAuthSignIn({ provider: "google" });
    const call = signInWithOAuth.mock.calls[0]?.[0] as {
      options: Record<string, unknown>;
    };
    expect(call.options).not.toHaveProperty("queryParams");
    expect(JSON.stringify(call)).not.toMatch(/redirect_to/);
  });

  it("throws returned Supabase Auth errors unchanged", async () => {
    const authError = Object.assign(new Error("provider denied"), { status: 400 });
    signInWithOAuth.mockResolvedValue({
      data: { url: null, provider: "google" },
      error: authError,
    });

    await expect(startNativeOAuthSignIn({ provider: "google" })).rejects.toBe(authError);
  });

  it("throws a safe generic error when data.url is missing", async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: null, provider: "google" },
      error: null,
    });

    await expect(startNativeOAuthSignIn({ provider: "google" })).rejects.toThrow(
      /OAuth authorization URL was not returned/,
    );
  });

  it("does not open sessions, exchange codes, or import browser client", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/getNativeSupabase/);
    expect(src).toMatch(/skipBrowserRedirect:\s*true/);
    expect(src).toMatch(/AUTH_RETURN_CUSTOM_CALLBACK/);
    expect(src).not.toMatch(/openNativeAuthSession|WebAuthSession|Browser\.open/);
    expect(src).not.toMatch(/exchangeCodeForSession|verifyOtp|token_hash/);
    expect(src).not.toMatch(/platform\/supabase\/browser|platform\/supabase\/_client/);
    expect(src).not.toMatch(/window\.location|@capacitor\/browser/);
    expect(src).not.toMatch(/\blogger\b|console\.(log|debug|info)/);
  });
});
