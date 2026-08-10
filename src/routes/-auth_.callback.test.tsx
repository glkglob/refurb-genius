/**
 * P0-AUTH-1 / PH-SENTRY-1D1-R1 — Auth callback route behavioral contracts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

import {
  __peekAuthCallbackBootstrapStateForTests,
  clearAuthCallbackBootstrapCapture,
  prepareAuthCallbackLocationForReplay,
  storeAuthCallbackBootstrapCapture,
  takeAuthCallbackBootstrapCapture,
} from "@/platform/sentry/replay-privacy";

const complete = vi.fn();
const useSearch = vi.fn();

vi.mock("@/features/auth", () => ({
  useAuthCallbackCompletion: () => ({ complete }),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (_path: string) => (opts: { component: () => ReactNode }) => ({
    options: opts,
    useSearch: () => useSearch(),
  }),
}));

import { Route } from "./auth_.callback";

const AuthCallback = Route.options.component as () => ReactNode;

const originalLocation = window.location;
const replaceState = vi.fn();

beforeEach(() => {
  complete.mockReset();
  useSearch.mockReset();
  replaceState.mockReset();
  complete.mockResolvedValue({ ok: true });
  clearAuthCallbackBootstrapCapture();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...originalLocation,
      href: "https://app.example/auth/callback?token_hash=secret-hash&type=email&flow=magiclink&redirect_to=%2Fprojects",
      pathname: "/auth/callback",
      search: "?token_hash=secret-hash&type=email&flow=magiclink&redirect_to=%2Fprojects",
      hash: "",
      origin: "https://app.example",
    },
  });
  Object.defineProperty(window.history, "replaceState", {
    configurable: true,
    value: replaceState,
  });
});

afterEach(() => {
  clearAuthCallbackBootstrapCapture();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
});

describe("AuthCallback route", () => {
  it("passes token_hash to completion as tokenHash exactly once", async () => {
    useSearch.mockReturnValue({
      token_hash: "secret-hash",
      type: "email",
      flow: "magiclink",
      redirect_to: "/projects",
    });

    render(createElement(AuthCallback));

    await waitFor(() => {
      expect(complete).toHaveBeenCalledTimes(1);
    });

    expect(complete).toHaveBeenCalledWith({
      code: undefined,
      tokenHash: "secret-hash",
      type: "email",
      urlError: undefined,
      errorDescription: undefined,
      redirectTo: "/projects",
    });
  });

  it("removes token_hash and code from browser history", async () => {
    useSearch.mockReturnValue({
      token_hash: "secret-hash",
      code: "pkce-code",
      type: "email",
      flow: "magiclink",
      redirect_to: "/projects",
    });

    render(createElement(AuthCallback));

    await waitFor(() => {
      expect(complete).toHaveBeenCalledTimes(1);
    });

    expect(replaceState).toHaveBeenCalled();
    const nextUrl = String(replaceState.mock.calls[0]?.[2] ?? "");
    expect(nextUrl).not.toMatch(/token_hash/);
    expect(nextUrl).not.toMatch(/code=/);
    expect(nextUrl).toMatch(/type=email/);
    expect(nextUrl).toMatch(/flow=magiclink/);
    expect(nextUrl).toMatch(/redirect_to=/);
  });

  it("removes access_token from hash fragments in browser history when query auth present", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        href: "https://app.example/auth/callback?code=pkce-code&type=email#access_token=SYNTHETIC_ACCESS&refresh_token=SYNTHETIC_REFRESH",
        pathname: "/auth/callback",
        search: "?code=pkce-code&type=email",
        hash: "#access_token=SYNTHETIC_ACCESS&refresh_token=SYNTHETIC_REFRESH",
        origin: "https://app.example",
      },
    });
    useSearch.mockReturnValue({ code: "pkce-code", type: "email" });

    render(createElement(AuthCallback));

    await waitFor(() => {
      expect(complete).toHaveBeenCalledTimes(1);
    });

    expect(replaceState).toHaveBeenCalled();
    const nextUrl = String(replaceState.mock.calls[0]?.[2] ?? "");
    expect(nextUrl).not.toMatch(/SYNTHETIC_ACCESS/);
    expect(nextUrl).not.toMatch(/SYNTHETIC_REFRESH/);
    expect(nextUrl).not.toMatch(/access_token=/);
    expect(nextUrl).toMatch(/type=email/);
  });

  it("renders safe failure UI without raw PKCE text and keeps Back to sign in", async () => {
    useSearch.mockReturnValue({
      code: "pkce",
    });
    complete.mockResolvedValue({
      ok: false,
      error:
        "This sign-in link was opened in a different browser or the original sign-in session is no longer available. Request a new link and open the new email in this browser.",
    });

    render(createElement(AuthCallback));

    expect(await screen.findByRole("heading", { name: /authentication failed/i })).toBeTruthy();
    expect(screen.getByText(/opened in a different browser/i)).toBeTruthy();
    expect(screen.queryByText(/code verifier/i)).toBeNull();
    expect(screen.queryByText(/pkce/i)).toBeNull();
    expect(screen.getByRole("link", { name: /back to sign in/i })).toHaveAttribute("href", "/auth");
  });

  it("shows accessible loading UI while completing", () => {
    useSearch.mockReturnValue({ code: "pkce" });
    complete.mockReturnValue(new Promise(() => undefined));

    render(createElement(AuthCallback));

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-busy", "true");
    expect(main).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText(/completing sign in/i)).toBeTruthy();
  });

  it("does not re-invoke complete when search object identity changes after start", async () => {
    useSearch.mockReturnValue({
      token_hash: "secret-hash",
      type: "email",
    });

    const { rerender } = render(createElement(AuthCallback));

    await waitFor(() => {
      expect(complete).toHaveBeenCalledTimes(1);
    });

    useSearch.mockReturnValue({
      type: "email",
      flow: "magiclink",
    });
    rerender(createElement(AuthCallback));

    await waitFor(() => {
      expect(complete).toHaveBeenCalledTimes(1);
    });
  });
});

describe("PH-SENTRY-1D1-R1 bootstrap integration (secret not injected via useSearch)", () => {
  it("dirty PKCE URL → prepare strip → cleaned useSearch → complete still receives code", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        href: "https://app.example/auth/callback?code=SYNTHETIC_CODE&type=email&redirect_to=%2Fdashboard",
        pathname: "/auth/callback",
        search: "?code=SYNTHETIC_CODE&type=email&redirect_to=%2Fdashboard",
        hash: "",
        origin: "https://app.example",
      },
    });

    // Real bootstrap path (same helper as sentry.ts module load).
    prepareAuthCallbackLocationForReplay();

    // Router would only see post-strip search — do NOT put secret in useSearch.
    useSearch.mockReturnValue({
      type: "email",
      redirect_to: "/dashboard",
      // deliberately no code
    });

    render(createElement(AuthCallback));

    await waitFor(() => {
      expect(complete).toHaveBeenCalledTimes(1);
    });

    expect(complete).toHaveBeenCalledWith({
      code: "SYNTHETIC_CODE",
      tokenHash: undefined,
      type: "email",
      urlError: undefined,
      errorDescription: undefined,
      redirectTo: "/dashboard",
    });

    // One-shot cleared after complete settles (route finally → clear).
    await waitFor(() => {
      expect(__peekAuthCallbackBootstrapStateForTests()).toEqual({
        pending: null,
        claimed: null,
        bootstrapClaimed: false,
      });
    });
    expect(takeAuthCallbackBootstrapCapture()).toBeNull();
  });

  it("dirty magic-link URL → prepare strip → cleaned useSearch → complete receives tokenHash", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        href: "https://app.example/auth/callback?token_hash=SYNTHETIC_TOKEN_HASH&type=email&flow=magiclink",
        pathname: "/auth/callback",
        search: "?token_hash=SYNTHETIC_TOKEN_HASH&type=email&flow=magiclink",
        hash: "",
        origin: "https://app.example",
      },
    });

    prepareAuthCallbackLocationForReplay();

    useSearch.mockReturnValue({
      type: "email",
      flow: "magiclink",
      // deliberately no token_hash
    });

    render(createElement(AuthCallback));

    await waitFor(() => {
      expect(complete).toHaveBeenCalledTimes(1);
    });

    expect(complete).toHaveBeenCalledWith({
      code: undefined,
      tokenHash: "SYNTHETIC_TOKEN_HASH",
      type: "email",
      urlError: undefined,
      errorDescription: undefined,
      redirectTo: undefined,
    });
  });

  it("live Route.useSearch values win over bootstrap when both present", async () => {
    storeAuthCallbackBootstrapCapture({
      code: "SYNTHETIC_BOOTSTRAP_STALE",
      type: "email",
    });
    useSearch.mockReturnValue({
      code: "SYNTHETIC_LIVE_CODE",
      type: "recovery",
    });

    render(createElement(AuthCallback));

    await waitFor(() => {
      expect(complete).toHaveBeenCalledTimes(1);
    });

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "SYNTHETIC_LIVE_CODE",
        type: "recovery",
      }),
    );
  });
});
