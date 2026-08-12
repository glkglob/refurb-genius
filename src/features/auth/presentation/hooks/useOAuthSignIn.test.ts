/**
 * AO-1E1.2 / IOS-READINESS-2B-3 — OAuth presentation hook contracts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AUTH_USER_QUERY_KEY } from "@/hooks/useAuth";

const startOAuthSignIn = vi.fn();
const startNativeOAuthSignIn = vi.fn();
const openNativeAuthSession = vi.fn();
const classifyAuthReturnUrl = vi.fn();
const completeNativeOAuthSignIn = vi.fn();
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

vi.mock("../../application/completeNativeOAuthSignIn", () => ({
  completeNativeOAuthSignIn: (input: unknown) => completeNativeOAuthSignIn(input),
}));

import { useOAuthSignIn } from "./useOAuthSignIn";

const SRC = join(__dirname, "useOAuthSignIn.ts");

const originalLocation = window.location;

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  startOAuthSignIn.mockReset();
  startNativeOAuthSignIn.mockReset();
  openNativeAuthSession.mockReset();
  classifyAuthReturnUrl.mockReset();
  completeNativeOAuthSignIn.mockReset();
  trackEvent.mockReset();
  isNativePlatform.mockReset();
  isNativePlatform.mockReturnValue(false);
  startOAuthSignIn.mockResolvedValue(undefined);
  startNativeOAuthSignIn.mockResolvedValue({
    url: "https://example.supabase.co/auth/v1/authorize?provider=google",
  });
  openNativeAuthSession.mockResolvedValue({ type: "cancel" });
  classifyAuthReturnUrl.mockReturnValue(null);
  completeNativeOAuthSignIn.mockResolvedValue({
    kind: "authenticated",
    user: { id: "u1", email: "a@b.com" },
    destination: "/dashboard",
  });
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

    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOAuthSignIn(), {
      wrapper: createWrapper(queryClient),
    });

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
    expect(completeNativeOAuthSignIn).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(AUTH_USER_QUERY_KEY)).toBeUndefined();
  });
});

describe("useOAuthSignIn — native path", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(true);
  });

  it("passes authorize URL to openNativeAuthSession and returns native-cancelled without seed", async () => {
    const authorizeUrl = "https://example.supabase.co/auth/v1/authorize?provider=google";
    startNativeOAuthSignIn.mockResolvedValue({ url: authorizeUrl });
    openNativeAuthSession.mockResolvedValue({ type: "cancel" });

    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOAuthSignIn(), {
      wrapper: createWrapper(queryClient),
    });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.startGoogleOAuth("/projects");
    });

    expect(startNativeOAuthSignIn).toHaveBeenCalledWith({ provider: "google" });
    expect(openNativeAuthSession).toHaveBeenCalledWith(authorizeUrl);
    expect(startOAuthSignIn).not.toHaveBeenCalled();
    expect(completeNativeOAuthSignIn).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: "native-cancelled" });
    expect(queryClient.getQueryData(AUTH_USER_QUERY_KEY)).toBeUndefined();
  });

  it("seeds AUTH_USER_QUERY_KEY once and returns native-authenticated destination only", async () => {
    const callbackUrl = "com.refurbgenius.app://auth/callback?code=abc";
    startNativeOAuthSignIn.mockResolvedValue({
      url: "https://example.supabase.co/auth/v1/authorize?provider=apple",
    });
    openNativeAuthSession.mockResolvedValue({ type: "success", url: callbackUrl });
    classifyAuthReturnUrl.mockReturnValue({ kind: "custom-scheme", url: callbackUrl });
    completeNativeOAuthSignIn.mockResolvedValue({
      kind: "authenticated",
      user: { id: "u1", email: "a@b.com", fullName: "Ada" },
      destination: "/projects",
    });

    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOAuthSignIn(), {
      wrapper: createWrapper(queryClient),
    });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.startAppleOAuth("/projects");
    });

    expect(completeNativeOAuthSignIn).toHaveBeenCalledTimes(1);
    expect(completeNativeOAuthSignIn).toHaveBeenCalledWith({
      callbackUrl,
      redirectTo: "/projects",
    });
    expect(outcome).toEqual({ kind: "native-authenticated", destination: "/projects" });
    expect(JSON.stringify(outcome)).not.toMatch(/code=|access_token|refresh_token|callback/);
    expect(queryClient.getQueryData(AUTH_USER_QUERY_KEY)).toEqual({
      id: "u1",
      email: "a@b.com",
      fullName: "Ada",
    });
  });

  it("does not seed on application error", async () => {
    const callbackUrl = "com.refurbgenius.app://auth/callback?code=abc";
    openNativeAuthSession.mockResolvedValue({ type: "success", url: callbackUrl });
    classifyAuthReturnUrl.mockReturnValue({ kind: "custom-scheme", url: callbackUrl });
    completeNativeOAuthSignIn.mockResolvedValue({
      kind: "error",
      message: "We could not complete sign-in. Please try again.",
    });

    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOAuthSignIn(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      act(async () => {
        await result.current.startGoogleOAuth();
      }),
    ).rejects.toThrow(/We could not complete sign-in/);

    expect(queryClient.getQueryData(AUTH_USER_QUERY_KEY)).toBeUndefined();
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

    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOAuthSignIn(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      act(async () => {
        await result.current.startGitHubOAuth();
      }),
    ).rejects.toThrow(/Invalid authentication return/);
    expect(completeNativeOAuthSignIn).not.toHaveBeenCalled();
  });

  it("guards concurrent native OAuth attempts", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    startNativeOAuthSignIn.mockImplementation(async () => {
      await gate;
      return { url: "https://example.supabase.co/auth/v1/authorize" };
    });

    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOAuthSignIn(), {
      wrapper: createWrapper(queryClient),
    });

    let first: Promise<unknown> | undefined;
    await act(async () => {
      first = result.current.startGoogleOAuth();
    });

    await expect(
      act(async () => {
        await result.current.startGoogleOAuth();
      }),
    ).rejects.toThrow(/already in progress/);

    release();
    openNativeAuthSession.mockResolvedValue({ type: "cancel" });
    await act(async () => {
      await first;
    });
  });

  it("does not call web cookie OAuth client on native path", async () => {
    openNativeAuthSession.mockResolvedValue({ type: "cancel" });
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOAuthSignIn(), {
      wrapper: createWrapper(queryClient),
    });
    await act(async () => {
      await result.current.startGoogleOAuth();
    });
    expect(startOAuthSignIn).not.toHaveBeenCalled();
  });
});

describe("useOAuthSignIn — source boundary", () => {
  it("does not log, toast, navigate, or set loading; seeds on success only via QueryClient", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/startOAuthSignIn/);
    expect(src).toMatch(/startNativeOAuthSignIn/);
    expect(src).toMatch(/openNativeAuthSession/);
    expect(src).toMatch(/classifyAuthReturnUrl/);
    expect(src).toMatch(/completeNativeOAuthSignIn/);
    expect(src).toMatch(/AUTH_USER_QUERY_KEY/);
    expect(src).toMatch(/setQueryData/);
    expect(src).toMatch(/native-authenticated/);
    expect(src).toMatch(/trackEvent/);
    expect(src).toMatch(/auth\/callback/);
    expect(src).toMatch(/redirect_to/);
    expect(src).not.toMatch(/\blogger\b|\btoast\b/);
    expect(src).not.toMatch(/useNavigate|navigate\s*\(/);
    expect(src).not.toMatch(/setOauthLoading|setAppleLoading|setGitHubLoading/);
    expect(src).not.toMatch(/@capacitor\/browser|Browser\.open/);
    expect(src).not.toMatch(/platform\/supabase\/browser|platform\/supabase\/_client/);
  });
});
