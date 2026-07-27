/**
 * AO-1E1.2 — OAuth initiation Auth primitive contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signInWithOAuth = vi.fn();

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    auth: {
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
    },
  },
}));

import { startOAuthSignIn } from "./startOAuthSignIn";

const SRC = join(__dirname, "startOAuthSignIn.ts");

beforeEach(() => {
  signInWithOAuth.mockReset();
  signInWithOAuth.mockResolvedValue({
    data: { url: "https://example.com/oauth", provider: "google" },
    error: null,
  });
});

describe("startOAuthSignIn", () => {
  it("uses platform browser Auth client via @/platform/supabase/browser", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).toMatch(/@\/platform\/supabase\/browser/);
    expect(src).toMatch(/supabase\.auth\.signInWithOAuth/);
  });

  it("calls signInWithOAuth once for Google with exact options", async () => {
    await startOAuthSignIn({
      provider: "google",
      redirectTo: "https://app.example/auth/callback",
      queryParams: { redirect_to: "/projects" },
    });

    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://app.example/auth/callback",
        queryParams: { redirect_to: "/projects" },
      },
    });
  });

  it("calls signInWithOAuth once for Apple with exact options", async () => {
    await startOAuthSignIn({
      provider: "apple",
      redirectTo: "https://app.example/auth/callback",
      queryParams: { redirect_to: "/dashboard" },
    });

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "apple",
      options: {
        redirectTo: "https://app.example/auth/callback",
        queryParams: { redirect_to: "/dashboard" },
      },
    });
  });

  it("passes undefined queryParams when omitted", async () => {
    await startOAuthSignIn({
      provider: "google",
      redirectTo: "https://app.example/auth/callback",
    });

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://app.example/auth/callback",
        queryParams: undefined,
      },
    });
  });

  it("preserves redirect_to key name exactly", async () => {
    await startOAuthSignIn({
      provider: "google",
      redirectTo: "https://app.example/auth/callback",
      queryParams: { redirect_to: "/settings" },
    });

    const call = signInWithOAuth.mock.calls[0][0] as {
      options: { queryParams: Record<string, string> };
    };
    expect(Object.keys(call.options.queryParams)).toEqual(["redirect_to"]);
  });

  it("throws returned Auth error unchanged", async () => {
    const err = Object.assign(new Error("OAuth provider error"), { status: 400 });
    signInWithOAuth.mockResolvedValue({ data: { url: null, provider: "google" }, error: err });

    await expect(
      startOAuthSignIn({
        provider: "google",
        redirectTo: "https://app.example/auth/callback",
      }),
    ).rejects.toBe(err);
  });

  it("propagates a genuinely rejected promise", async () => {
    signInWithOAuth.mockRejectedValue(new Error("network down"));

    await expect(
      startOAuthSignIn({
        provider: "apple",
        redirectTo: "https://app.example/auth/callback",
      }),
    ).rejects.toThrow("network down");
  });

  it("resolves on success without returning provider data", async () => {
    await expect(
      startOAuthSignIn({
        provider: "google",
        redirectTo: "https://app.example/auth/callback",
      }),
    ).resolves.toBeUndefined();
  });

  it("contains no window, analytics, logger, toast, navigation, or QC", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\bwindow\b/);
    expect(src).not.toMatch(/trackEvent|identifyAnalyticsUser/);
    expect(src).not.toMatch(/\blogger\b|\btoast\b/);
    expect(src).not.toMatch(/navigate|useNavigate/);
    expect(src).not.toMatch(/QueryClient|useQueryClient|setQueryData/);
    expect(src).not.toMatch(/localStorage|\.from\s*\(/);
    expect(src).not.toMatch(/from ["']react["']/);
  });
});
