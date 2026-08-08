/**
 * AO-1S1 + IA-7-R2 + IA-8 — MobileTopBar final mobile IA and sign-out.
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

describe("MobileTopBar IA-8 final mobile destinations", () => {
  it("exposes Home | Projects | + New | Copilot primary row from canonical authority", () => {
    render(createElement(MobileTopBar));
    expect(screen.getByTestId("mobile-nav-dashboard").getAttribute("href")).toBe("/dashboard");
    expect(screen.getByTestId("mobile-nav-projects").getAttribute("href")).toBe("/projects");
    expect(screen.getByTestId("mobile-nav-new_analysis").getAttribute("href")).toBe("/analyze");
    expect(screen.getByTestId("mobile-nav-deal_copilot").getAttribute("href")).toBe(
      "/deal-copilot",
    );
    expect(screen.getByTestId("mobile-nav-more")).toBeTruthy();
    // + New is visually distinct but remains navigation-only (href only).
    expect(screen.getByTestId("mobile-nav-new_analysis").textContent).toMatch(/\+?\s*New/i);
    expect(screen.getByLabelText("Home")).toBeTruthy();
    expect(screen.getByLabelText("New Analysis")).toBeTruthy();
    expect(screen.getByLabelText("Deal Copilot")).toBeTruthy();
  });

  it("exposes Trades / Marketplace and Settings through More menu", async () => {
    render(createElement(MobileTopBar));
    await openMoreMenu();
    const trades = await screen.findByTestId("mobile-nav-trades_marketplace");
    const settings = await screen.findByTestId("mobile-nav-settings");
    expect(trades.getAttribute("href")).toBe("/trades");
    expect(settings.getAttribute("href")).toBe("/settings");
    expect(within(trades).getByText("Trades / Marketplace")).toBeTruthy();
    expect(within(settings).getByText("Settings")).toBeTruthy();
  });

  it("More menu surface uses shared bg-popover (opaque theme token; IA-8-R1)", async () => {
    render(createElement(MobileTopBar));
    await openMoreMenu();
    const menu = await screen.findByRole("menu");
    // Runtime opacity is enforced by Tailwind @theme registration of --color-popover;
    // the menu must keep the design-system surface class (not bg-white / transparent).
    expect(menu.className).toMatch(/\bbg-popover\b/);
    expect(menu.className).toMatch(/\btext-popover-foreground\b/);
    expect(menu.className).not.toMatch(/\bbg-transparent\b/);
    expect(menu.className).not.toMatch(/\bbg-white\b/);
    expect(menu.className).toMatch(/\bz-50\b/);
  });

  it("does not hard-code a second nav route map (reuses GLOBAL_NAV_ITEMS helpers)", () => {
    const src = readFileSync(join(__dirname, "MobileTopBar.tsx"), "utf8");
    expect(src).toMatch(/getMobilePrimaryNavItems|getMobileMoreNavItems/);
    expect(src).toMatch(/@\/features\/navigation/);
    expect(src).not.toMatch(/to:\s*["']\/studies["']/);
  });

  it("marks Home active on /dashboard and New Analysis active on /analyze", () => {
    pathname = "/dashboard";
    const { unmount } = render(createElement(MobileTopBar));
    expect(screen.getByTestId("mobile-nav-dashboard").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("mobile-nav-projects").getAttribute("data-active")).toBe("false");
    unmount();

    pathname = "/analyze";
    render(createElement(MobileTopBar));
    expect(screen.getByTestId("mobile-nav-new_analysis").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("mobile-nav-projects").getAttribute("data-active")).toBe("false");
  });

  it("marks Projects active on selected-project routes", () => {
    pathname = "/projects/abc/upload";
    render(createElement(MobileTopBar));
    expect(screen.getByTestId("mobile-nav-projects").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("mobile-nav-new_analysis").getAttribute("data-active")).toBe("false");
  });

  it("does not place Studies or stage labels in primary mobile nav", () => {
    render(createElement(MobileTopBar));
    const primary = screen.getByTestId("mobile-primary-nav").textContent ?? "";
    expect(primary).not.toMatch(/Studies/i);
    expect(primary).not.toMatch(/Photos|Analysis|Redesign|Estimate|Export/i);
  });
});

describe("MobileTopBar sign-out (AO-1S1 + IA-8 More menu)", () => {
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
