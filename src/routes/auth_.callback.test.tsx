/**
 * P0-AUTH-1 — Auth callback route behavioral contracts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

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
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...originalLocation,
      href: "https://app.example/auth/callback?token_hash=secret-hash&type=email&flow=magiclink&redirect_to=%2Fprojects",
      pathname: "/auth/callback",
      search: "?token_hash=secret-hash&type=email&flow=magiclink&redirect_to=%2Fprojects",
      hash: "",
    },
  });
  Object.defineProperty(window.history, "replaceState", {
    configurable: true,
    value: replaceState,
  });
});

afterEach(() => {
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
