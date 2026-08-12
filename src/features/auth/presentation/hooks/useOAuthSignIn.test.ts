/**
 * AO-1E1.2 / IOS-READINESS-2B-2 — OAuth presentation hook contracts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const startOAuthSignIn = vi.fn();
const startNativeOAuthSignIn = vi.fn();
const openNativeAuthSession = vi.fn();
const classifyAuthReturnUrl = vi.fn();
const trackEvent = vi.fn();
const isNativePlatform = vi.fn();

vi.mock("@/lib/analytics", () => ({
  trackEvent: (name: unknown, props?: unknown) => trackEvent(name, props),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("../../infrastructure/startOAuthSignIn", () => ({
  startOAuthSignIn: (input: unknown) => startOAuthSignIn(input),
}));

vi.mock("../../infrastructure/startNativeOAuthSignIn", () => ({
  startNativeOAuthSignIn: (input: unknown) => startNativeOAuthSignIn(input),
}));

vi.mock("@/platform/auth/native/web-auth-session", () => ({
  openNativeAuthSession: (url: unknown) => openNativeAuthSession(url),
}));

vi.mock("@/platform/auth/native/auth-return", () => ({
  classifyAuthReturnUrl: (url: unknown) => classifyAuthReturnUrl(url),
}));

import { useOAuthSignIn } from "./useOAuthSignIn";

const SRC = join(__dirname, "useOAuthSignIn.ts");

const originalLocation = window.location;

beforeEach(() => {
  startOAuthSignIn.mockReset();
  startNativeOAuthSignIn.mockReset();
  openNativeAuthSession.mockReset();
  classifyAuthReturnUrl.mockReset();
  trackEvent.mockReset();
  isNativePlatform.mockReset();
  isNativePlatform.mockReturnValue(false);
  startOAuthSignIn.mockResolvedValue(undefined);
  startNativeOAuthSignIn.mockResolvedValue({
    url: "https://example.supabase.co/auth/v1/authorize?provider=google",
  });
  openNativeAuthSession.mockResolvedValue({ type: "cancel" });
  classifyAuthReturnUrl.mockReturnValue(null);
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, origin: "https://app.example" },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
});

describe("useOAuthSignIn — web Google", () => {
  it("tracks analytics before primitive with exact callback URL and redirect_to", async () => {
    const order: string[] = [];
    trackEvent.mockImplementation(() => {
      order.push("analytics");
    });
    startOAuthSignIn.mockImplementation(async () => {
      order.push("auth");
    });

    const { result } = renderHook(() => useOAuthSignIn());

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.startGoogleOAuth("/projects");
    });

    expect(order).toEqual(["analytics", "auth"]);
    expect(trackEvent).toHaveBeenCalledWith("oauth_sign_in_initiated", {
      provider: "google",
    });
    expect(startOAuthSignIn).toHaveBeenCalledWith({
      provider: "google",
      redirectTo: "https://app.example/auth/callback",
      queryParams: { redirect_to: "/projects" },
    });
    expect(outcome).toEqual({ kind: "web-redirecting" });
    expect(startNativeOAuthSignIn).not.toHaveBeenCalled();
    expect(openNativeAuthSession).not.toHaveBeenCalled();
  });

  it("omits queryParams when redirect is falsy", async () => {
    const { result } = renderHook(() => useOAuthSignIn());

    await act(async () => {
      await result.current.startGoogleOAuth(undefined);
    });

    expect(startOAuthSignIn).toHaveBeenCalledWith({
      provider: "google",
      redirectTo: "https://app.example/auth/callback",
      queryParams: undefined,
    });
  });

  it("propagates primitive errors without logger or navigation", async () => {
    startOAuthSignIn.mockRejectedValue(new Error("OAuth denied"));
    const { result } = renderHook(() => useOAuthSignIn());

    await expect(
      act(async () => {
        await result.current.startGoogleOAuth("/projects");
      }),
    ).rejects.toThrow("OAuth denied");

    expect(trackEvent).toHaveBeenCalledTimes(1);
  });
});

describe("useOAuthSignIn — web Apple", () => {
  it("tracks analytics before primitive with exact Apple provider", async () => {
    const order: string[] = [];
    trackEvent.mockImplementation(() => {
      order.push("analytics");
    });
    startOAuthSignIn.mockImplementation(async () => {
      order.push("auth");
    });

    const { result } = renderHook(() => useOAuthSignIn());

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.startAppleOAuth("/settings");
    });

    expect(order).toEqual(["analytics", "auth"]);
    expect(trackEvent).toHaveBeenCalledWith("oauth_sign_in_initiated", {
      provider: "apple",
    });
    expect(startOAuthSignIn).toHaveBeenCalledWith({
      provider: "apple",
      redirectTo: "https://app.example/auth/callback",
      queryParams: { redirect_to: "/settings" },
    });
    expect(outcome).toEqual({ kind: "web-redirecting" });
  });

  it("propagates Apple Auth failures", async () => {
    startOAuthSignIn.mockRejectedValue(new Error("Apple failed"));
    const { result } = renderHook(() => useOAuthSignIn());

    await expect(
      act(async () => {
        await result.current.startAppleOAuth();
      }),
    ).rejects.toThrow("Apple failed");
  });
});

describe("useOAuthSignIn — web GitHub", () => {
  it("tracks analytics before primitive with exact GitHub provider and redirect_to", async () => {
    const order: string[] = [];
    trackEvent.mockImplementation(() => {
      order.push("analytics");
    });
    startOAuthSignIn.mockImplementation(async () => {
      order.push("auth");
    });

    const { result } = renderHook(() => useOAuthSignIn());

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.startGitHubOAuth("/projects");
    });

    expect(order).toEqual(["analytics", "auth"]);
    expect(trackEvent).toHaveBeenCalledWith("oauth_sign_in_initiated", {
      provider: "github",
    });
    expect(startOAuthSignIn).toHaveBeenCalledWith({
      provider: "github",
      redirectTo: "https://app.example/auth/callback",
      queryParams: {
        redirect_to: "/projects",
      },
    });
    expect(outcome).toEqual({ kind: "web-redirecting" });
  });

  it("omits queryParams when redirect is undefined", async () => {
    const { result } = renderHook(() => useOAuthSignIn());

    await act(async () => {
      await result.current.startGitHubOAuth(undefined);
    });

    expect(startOAuthSignIn).toHaveBeenCalledWith({
      provider: "github",
      redirectTo: "https://app.example/auth/callback",
      queryParams: undefined,
    });
  });

  it("propagates primitive errors unchanged", async () => {
    startOAuthSignIn.mockRejectedValue(new Error("GitHub authorization failed"));
    const { result } = renderHook(() => useOAuthSignIn());

    await expect(
      act(async () => {
        await result.current.startGitHubOAuth("/projects");
      }),
    ).rejects.toThrow("GitHub authorization failed");

    expect(trackEvent).toHaveBeenCalledTimes(1);
  });
});

describe("useOAuthSignIn — native path", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(true);
  });

  it("passes authorize URL to openNativeAuthSession and returns native-cancelled", async () => {
    const authorizeUrl = "https://example.supabase.co/auth/v1/authorize?provider=google";
    startNativeOAuthSignIn.mockResolvedValue({ url: authorizeUrl });
    openNativeAuthSession.mockResolvedValue({ type: "cancel" });

    const { result } = renderHook(() => useOAuthSignIn());

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.startGoogleOAuth("/projects");
    });

    expect(startNativeOAuthSignIn).toHaveBeenCalledWith({ provider: "google" });
    expect(openNativeAuthSession).toHaveBeenCalledWith(authorizeUrl);
    expect(startOAuthSignIn).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: "native-cancelled" });
    expect(classifyAuthReturnUrl).not.toHaveBeenCalled();
    // Application redirect must not be forwarded into native OAuth.
    expect(startNativeOAuthSignIn.mock.calls[0]?.[0]).toEqual({ provider: "google" });
  });

  it("returns native-callback only for classified custom-scheme surfaces", async () => {
    const callbackUrl = "com.refurbgenius.app://auth/callback?code=abc";
    startNativeOAuthSignIn.mockResolvedValue({
      url: "https://example.supabase.co/auth/v1/authorize?provider=apple",
    });
    openNativeAuthSession.mockResolvedValue({ type: "success", url: callbackUrl });
    classifyAuthReturnUrl.mockReturnValue({ kind: "custom-scheme", url: callbackUrl });

    const { result } = renderHook(() => useOAuthSignIn());

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.startAppleOAuth();
    });

    expect(classifyAuthReturnUrl).toHaveBeenCalledWith(callbackUrl);
    expect(outcome).toEqual({ kind: "native-callback", url: callbackUrl });
    expect(trackEvent).toHaveBeenCalledWith("oauth_sign_in_initiated", { provider: "apple" });
    // Analytics must not include callback/authorize secrets.
    for (const call of trackEvent.mock.calls) {
      expect(JSON.stringify(call)).not.toMatch(/code=|authorize\?|com\.refurbgenius\.app:\/\//);
    }
  });

  it("rejects universal-link OAuth results with a safe generic error", async () => {
    openNativeAuthSession.mockResolvedValue({
      type: "success",
      url: "https://www.refurbgenius.info/auth/native-callback?code=x",
    });
    classifyAuthReturnUrl.mockReturnValue({
      kind: "universal-link",
      url: "https://www.refurbgenius.info/auth/native-callback?code=x",
    });

    const { result } = renderHook(() => useOAuthSignIn());

    await expect(
      act(async () => {
        await result.current.startGitHubOAuth();
      }),
    ).rejects.toThrow(/Invalid authentication return/);
  });

  it("rejects malformed callbacks that fail classification", async () => {
    openNativeAuthSession.mockResolvedValue({
      type: "success",
      url: "https://evil.example/phish",
    });
    classifyAuthReturnUrl.mockReturnValue(null);

    const { result } = renderHook(() => useOAuthSignIn());

    await expect(
      act(async () => {
        await result.current.startGoogleOAuth();
      }),
    ).rejects.toThrow(/Invalid authentication return/);
  });

  it("does not call exchange or web cookie client on native success", async () => {
    const callbackUrl = "com.refurbgenius.app://auth/callback?code=abc";
    openNativeAuthSession.mockResolvedValue({ type: "success", url: callbackUrl });
    classifyAuthReturnUrl.mockReturnValue({ kind: "custom-scheme", url: callbackUrl });

    const { result } = renderHook(() => useOAuthSignIn());
    await act(async () => {
      await result.current.startGoogleOAuth();
    });

    expect(startOAuthSignIn).not.toHaveBeenCalled();
  });
});

describe("useOAuthSignIn — source boundary", () => {
  it("does not log, toast, navigate, or set loading; keeps web and native primitives", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/startOAuthSignIn/);
    expect(src).toMatch(/startNativeOAuthSignIn/);
    expect(src).toMatch(/openNativeAuthSession/);
    expect(src).toMatch(/classifyAuthReturnUrl/);
    expect(src).toMatch(/trackEvent/);
    expect(src).toMatch(/auth\/callback/);
    expect(src).toMatch(/redirect_to/);
    expect(src).toMatch(/web-redirecting|native-cancelled|native-callback/);
    expect(src).not.toMatch(/\blogger\b|\btoast\b/);
    expect(src).not.toMatch(/useNavigate|navigate\s*\(/);
    expect(src).not.toMatch(/setOauthLoading|setAppleLoading|setGitHubLoading|useState/);
    expect(src).not.toMatch(/exchangeCodeForSession|verifyOtp/);
    expect(src).not.toMatch(/@capacitor\/browser|Browser\.open/);
    expect(src).not.toMatch(/platform\/supabase\/browser|platform\/supabase\/_client/);
  });
});
