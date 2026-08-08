/**
 * AO-1S1 + IA-7-R2 — MobileTopBar sign-out and canonical mobile destinations.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signOut = vi.fn();
const navigate = vi.fn();
let pathname = "/dashboard";

vi.mock("@/features/auth", () => ({
  useSignOut: () => ({
    signOut: (...args: unknown[]) => signOut(...args),
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...rest }: { children?: ReactNode; to: string; [key: string]: unknown }) =>
    createElement("a", { href: typeof to === "string" ? to : "#", ...rest }, children),
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname } }),
}));

import { MobileTopBar } from "./MobileTopBar";

beforeEach(() => {
  signOut.mockReset();
  navigate.mockReset();
  signOut.mockResolvedValue(undefined);
  pathname = "/dashboard";
});

async function openMoreMenu() {
  const trigger = screen.getByTestId("mobile-nav-more");
  // Radix DropdownMenu opens via pointer down + click sequence in jsdom.
  await act(async () => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.pointerUp(trigger);
    fireEvent.click(trigger);
  });
  await screen.findByRole("menu");
}

describe("MobileTopBar IA-7-R2 canonical mobile destinations", () => {
  it("exposes primary mobile destinations from canonical nav authority", () => {
    render(createElement(MobileTopBar));
    expect(screen.getByTestId("mobile-nav-dashboard").getAttribute("href")).toBe("/dashboard");
    expect(screen.getByTestId("mobile-nav-projects").getAttribute("href")).toBe("/projects");
    expect(screen.getByTestId("mobile-nav-trades_marketplace").getAttribute("href")).toBe(
      "/trades",
    );
    expect(screen.getByTestId("mobile-nav-new_analysis").getAttribute("href")).toBe("/analyze");
    expect(screen.getByTestId("mobile-nav-more")).toBeTruthy();
  });

  it("exposes Deal Copilot and Settings through More menu using canonical routes", async () => {
    render(createElement(MobileTopBar));
    await openMoreMenu();
    const copilot = await screen.findByTestId("mobile-nav-deal_copilot");
    const settings = await screen.findByTestId("mobile-nav-settings");
    expect(copilot.getAttribute("href")).toBe("/deal-copilot");
    expect(settings.getAttribute("href")).toBe("/settings");
    expect(within(copilot).getByText("Deal Copilot")).toBeTruthy();
    expect(within(settings).getByText("Settings")).toBeTruthy();
  });

  it("does not hard-code a second nav route map (reuses GLOBAL_NAV_ITEMS helpers)", () => {
    const src = readFileSync(join(__dirname, "MobileTopBar.tsx"), "utf8");
    expect(src).toMatch(/getMobilePrimaryNavItems|getMobileMoreNavItems|getGlobalNavItem/);
    expect(src).toMatch(/@\/features\/navigation/);
    expect(src).not.toMatch(/to:\s*["']\/studies["']/);
  });

  it("marks New Analysis active on /analyze primary control", () => {
    pathname = "/analyze";
    render(createElement(MobileTopBar));
    expect(screen.getByTestId("mobile-nav-new_analysis").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("mobile-nav-projects").getAttribute("data-active")).toBe("false");
  });
});

describe("MobileTopBar sign-out (AO-1S1 + IA-7-R2 More menu)", () => {
  it("renders Sign out inside More menu with accessible label", async () => {
    render(createElement(MobileTopBar));
    await openMoreMenu();
    const signOutItem = await screen.findByTestId("mobile-nav-sign-out");
    expect(signOutItem).toBeTruthy();
    expect(within(signOutItem).getByText("Sign out")).toBeTruthy();
  });

  it("calls feature signOut exactly once then navigates to /", async () => {
    let resolveSignOut: (() => void) | undefined;
    signOut.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = resolve;
        }),
    );

    render(createElement(MobileTopBar));
    await openMoreMenu();
    fireEvent.click(await screen.findByTestId("mobile-nav-sign-out"));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();

    resolveSignOut?.();
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith({ to: "/" });
    });
  });

  it("orders await signOut before navigate and has no failure-path navigation", () => {
    const src = readFileSync(join(__dirname, "MobileTopBar.tsx"), "utf8");
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
