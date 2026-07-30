/**
 * AO-1E1.2 — OAuth presentation hook contracts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const startOAuthSignIn = vi.fn();
const trackEvent = vi.fn();

vi.mock("@/lib/analytics", () => ({
  trackEvent: (name: unknown, props?: unknown) => trackEvent(name, props),
}));

vi.mock("../../infrastructure/startOAuthSignIn", () => ({
  startOAuthSignIn: (input: unknown) => startOAuthSignIn(input),
}));

import { useOAuthSignIn } from "./useOAuthSignIn";

const SRC = join(__dirname, "useOAuthSignIn.ts");

const originalLocation = window.location;

beforeEach(() => {
  startOAuthSignIn.mockReset();
  trackEvent.mockReset();
  startOAuthSignIn.mockResolvedValue(undefined);
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

describe("useOAuthSignIn — Google", () => {
  it("tracks analytics before primitive with exact callback URL and redirect_to", async () => {
    const order: string[] = [];
    trackEvent.mockImplementation(() => {
      order.push("analytics");
    });
    startOAuthSignIn.mockImplementation(async () => {
      order.push("auth");
    });

    const { result } = renderHook(() => useOAuthSignIn());

    await act(async () => {
      await result.current.startGoogleOAuth("/projects");
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

describe("useOAuthSignIn — Apple", () => {
  it("tracks analytics before primitive with exact Apple provider", async () => {
    const order: string[] = [];
    trackEvent.mockImplementation(() => {
      order.push("analytics");
    });
    startOAuthSignIn.mockImplementation(async () => {
      order.push("auth");
    });

    const { result } = renderHook(() => useOAuthSignIn());

    await act(async () => {
      await result.current.startAppleOAuth("/settings");
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

describe("useOAuthSignIn — GitHub", () => {
  it("tracks analytics before primitive with exact GitHub provider and redirect_to", async () => {
    const order: string[] = [];
    trackEvent.mockImplementation(() => {
      order.push("analytics");
    });
    startOAuthSignIn.mockImplementation(async () => {
      order.push("auth");
    });

    const { result } = renderHook(() => useOAuthSignIn());

    await act(async () => {
      await result.current.startGitHubOAuth("/projects");
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

describe("useOAuthSignIn — source boundary", () => {
  it("does not log, toast, navigate, or set loading", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/startOAuthSignIn/);
    expect(src).toMatch(/trackEvent/);
    expect(src).toMatch(/auth\/callback/);
    expect(src).toMatch(/redirect_to/);
    expect(src).toMatch(/startGitHubOAuth/);
    expect(src).not.toMatch(/\blogger\b|\btoast\b/);
    expect(src).not.toMatch(/useNavigate|navigate\s*\(/);
    expect(src).not.toMatch(/setOauthLoading|setAppleLoading|setGitHubLoading|useState/);
    expect(src).not.toMatch(/@\/platform\/supabase/);
  });
});
