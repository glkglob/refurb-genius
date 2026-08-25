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
  it("renders the six canonical primary destinations with Marketplace after Deal Copilot", () => {
    render(createElement(Sidebar));
    expect(screen.getByTestId("global-nav-dashboard")).toBeTruthy();
    expect(screen.getByTestId("global-nav-projects")).toBeTruthy();
    expect(screen.getByTestId("global-nav-new_analysis")).toBeTruthy();
    expect(screen.getByTestId("global-nav-deal_copilot")).toBeTruthy();
    expect(screen.getByTestId("global-nav-trades_marketplace")).toBeTruthy();
    expect(screen.getByTestId("global-nav-settings")).toBeTruthy();
    expect(screen.getByText("Projects")).toBeTruthy();
    expect(screen.getByText("New Analysis")).toBeTruthy();
    expect(screen.getByText("Marketplace")).toBeTruthy();
    expect(screen.queryByText("Trades")).toBeNull();
    expect(screen.getByTestId("global-nav-trades_marketplace").getAttribute("href")).toBe(
      "/marketplace",
    );
    expect(screen.getByTestId("global-nav-deal_copilot").getAttribute("href")).toBe(
      "/deal-copilot",
    );
    const order = [
      "global-nav-dashboard",
      "global-nav-projects",
      "global-nav-new_analysis",
      "global-nav-deal_copilot",
      "global-nav-trades_marketplace",
      "global-nav-settings",
    ].map((id) => screen.getByTestId(id));
    for (let i = 1; i < order.length; i += 1) {
      expect(
        Boolean(
          order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ).toBe(true);
    }
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

  it("uses lg persistent chrome and light-mode dark sidebar surface", () => {
    render(createElement(Sidebar));
    const src = readFileSync(join(__dirname, "Sidebar.tsx"), "utf8");
    expect(src).toMatch(/lg:flex/);
    expect(src).not.toMatch(/md:flex/);
    expect(src).toMatch(/bg-\[#0B1F35\]/);
    expect(src).toMatch(/dark:bg-card/);
    expect(src).not.toMatch(/from-teal-500/);
    expect(src).toMatch(/GLOBAL_NAV_ITEMS/);
    expect(src).toMatch(/to=\{item\.to\}/);
    expect(src).toMatch(/\{item\.label\}/);
    expect(src).not.toMatch(/SIDEBAR_VISIBLE_LABEL/);
    expect(src).not.toMatch(/item\.id === "trades_marketplace"/);
    expect(src).not.toMatch(/Partial<Record<GlobalNavItemId,\s*string>>/);
    expect(screen.getByTestId("app-sidebar")).toBeTruthy();
    const globalNav = readFileSync(join(__dirname, "../features/navigation/globalNav.ts"), "utf8");
    expect(globalNav).toMatch(/id: "trades_marketplace"/);
    expect(globalNav).toMatch(/label:\s*"Marketplace"/);
    expect(globalNav).toMatch(/to: "\/marketplace"/);
    expect(globalNav).not.toMatch(/label:\s*"Trades"/);
    const mobileNav = readFileSync(join(__dirname, "./MobileBottomNav.tsx"), "utf8");
    expect(mobileNav).toMatch(/Home \| Projects \| New \| Deal Copilot \| More/);
    expect(mobileNav).not.toMatch(/Home \| Projects \| New \| Deal Copilot \| Marketplace/);
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
