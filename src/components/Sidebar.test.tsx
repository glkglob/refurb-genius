/**
 * AO-1S1 — Sidebar sign-out uses feature useSignOut; navigation after success only.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signOut = vi.fn();
const navigate = vi.fn();
const useAuth = vi.fn();

vi.mock("@/features/auth", () => ({
  useSignOut: () => ({
    signOut: (...args: unknown[]) => signOut(...args),
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: (...args: unknown[]) => useAuth(...args),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...rest }: { children?: ReactNode; to: string; [key: string]: unknown }) =>
    createElement("a", { href: typeof to === "string" ? to : "#", ...rest }, children),
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: "/dashboard" } }),
}));

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => createElement("div", { "data-testid": "theme-toggle" }),
}));

import { Sidebar } from "./Sidebar";

beforeEach(() => {
  signOut.mockReset();
  navigate.mockReset();
  useAuth.mockReset();
  useAuth.mockReturnValue({
    user: { id: "u1", email: "user@example.com", fullName: "Test User" },
  });
  signOut.mockResolvedValue(undefined);
});

describe("Sidebar IA-7 global navigation", () => {
  it("renders the six canonical primary destinations", () => {
    render(createElement(Sidebar));
    expect(screen.getByTestId("global-nav-dashboard")).toBeTruthy();
    expect(screen.getByTestId("global-nav-projects")).toBeTruthy();
    expect(screen.getByTestId("global-nav-new_analysis")).toBeTruthy();
    expect(screen.getByTestId("global-nav-deal_copilot")).toBeTruthy();
    expect(screen.getByTestId("global-nav-trades_marketplace")).toBeTruthy();
    expect(screen.getByTestId("global-nav-settings")).toBeTruthy();
    expect(screen.getByText("Projects")).toBeTruthy();
    expect(screen.getByText("New Analysis")).toBeTruthy();
    expect(screen.getByText("Trades")).toBeTruthy();
  });

  it("does not expose Studies as a primary nav item", () => {
    render(createElement(Sidebar));
    expect(screen.queryByText("Studies")).toBeNull();
    expect(screen.queryByText("New Study")).toBeNull();
  });

  it("marks Dashboard active on /dashboard", () => {
    render(createElement(Sidebar));
    expect(screen.getByTestId("global-nav-dashboard").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("global-nav-projects").getAttribute("data-active")).toBe("false");
  });
});

describe("Sidebar sign-out (AO-1S1)", () => {
  it("renders the Sign out control", () => {
    render(createElement(Sidebar));
    expect(screen.getByRole("button", { name: /sign out/i })).toBeTruthy();
  });

  it("calls feature signOut exactly once then navigates to /", async () => {
    let resolveSignOut: (() => void) | undefined;
    signOut.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = resolve;
        }),
    );

    render(createElement(Sidebar));
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();

    resolveSignOut?.();
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith({ to: "/" });
    });
  });

  it("orders await signOut before navigate and has no failure-path navigation", () => {
    const src = readFileSync(join(__dirname, "Sidebar.tsx"), "utf8");
    const handler = src.match(
      /const\s+handleLogout\s*=\s*async\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\n\s*\};/,
    );
    expect(handler?.[1]).toBeTruthy();
    const body = handler![1]!;
    expect(body).toMatch(/await\s+signOut\s*\(\s*\)/);
    expect(body).toMatch(/navigate\s*\(\s*\{\s*to\s*:\s*["']\/["']\s*\}\s*\)/);
    expect(body.indexOf("await signOut()")).toBeLessThan(body.indexOf("navigate("));
    expect(body).not.toMatch(/finally/);
    expect(body).not.toMatch(/catch\s*\(/);
  });
});
