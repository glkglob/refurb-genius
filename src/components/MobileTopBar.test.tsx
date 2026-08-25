/**
 * Mobile A — top bar is identity chrome; destinations live in MobileBottomNav.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const useAuth = vi.fn();
const signOut = vi.fn();
const navigate = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: (...args: unknown[]) => useAuth(...args),
}));

vi.mock("@/features/auth", () => ({
  useSignOut: () => ({
    signOut: (...args: unknown[]) => signOut(...args),
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...rest }: { children?: ReactNode; to: string; [key: string]: unknown }) =>
    createElement("a", { href: typeof to === "string" ? to : "#", ...rest }, children),
  useNavigate: () => navigate,
}));

import { MobileTopBar } from "./MobileTopBar";

const SRC = readFileSync(join(__dirname, "MobileTopBar.tsx"), "utf8");

async function openProfileMenu() {
  const trigger = screen.getByTestId("mobile-top-bar-profile");
  // Radix DropdownMenu opens via pointer down + click sequence in jsdom.
  await act(async () => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.pointerUp(trigger);
    fireEvent.click(trigger);
  });
  return screen.findByRole("menu");
}

beforeEach(() => {
  useAuth.mockReset();
  signOut.mockReset();
  navigate.mockReset();
  signOut.mockResolvedValue(undefined);
  useAuth.mockReturnValue({
    user: { id: "u1", email: "ada@example.com", fullName: "Ada Lovelace" },
  });
});

describe("MobileTopBar identity chrome", () => {
  it("exposes Refurb Genius home and does not own the primary destination row", () => {
    render(createElement(MobileTopBar));
    expect(screen.getByTestId("mobile-nav-brand").getAttribute("href")).toBe("/dashboard");
    expect(screen.getByLabelText("Refurb Genius home")).toBeTruthy();
    expect(screen.queryByTestId("mobile-primary-nav")).toBeNull();
    expect(screen.queryByTestId("mobile-nav-dashboard")).toBeNull();
    expect(screen.queryByTestId("mobile-nav-deal_copilot")).toBeNull();
    expect(screen.queryByTestId("mobile-nav-more")).toBeNull();
  });

  it("shows signed-in initials without truncating the product name", () => {
    render(createElement(MobileTopBar));
    expect(screen.getByTestId("mobile-top-bar-profile")).toBeTruthy();
    expect(screen.getByText("Refurb Genius")).toBeTruthy();
  });

  it("uses min-height identity row and hides from lg, not a clipped h-14 destination bar", () => {
    render(createElement(MobileTopBar));
    const header = screen.getByTestId("mobile-top-bar");
    expect(header.className).toMatch(/\blg:hidden\b/);
    expect(header.className).toContain("supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]");

    const row = screen.getByTestId("mobile-top-bar-row");
    expect(row.className).toMatch(/\bmin-h-14\b/);
    expect(row.className).not.toMatch(/(?:^|\s)h-14(?:\s|$)/);

    // Negative source checks cannot be satisfied by comment text.
    expect(SRC).not.toMatch(/text-\[10px\]/);
    expect(SRC).not.toMatch(/PRIMARY_SHORT_LABEL/);
    expect(SRC).not.toMatch(/getMobilePrimaryNavItems/);
  });

  it("renders no More control and no primary destination tabs", () => {
    render(createElement(MobileTopBar));
    expect(screen.queryByTestId("mobile-nav-more")).toBeNull();
    expect(screen.queryByLabelText("More navigation")).toBeNull();
    for (const id of [
      "mobile-nav-dashboard",
      "mobile-nav-projects",
      "mobile-nav-new_analysis",
      "mobile-nav-deal_copilot",
      "mobile-nav-trades_marketplace",
      "mobile-nav-settings",
      "mobile-nav-theme",
    ]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    // Destination authority is not consumed here at all.
    expect(SRC).not.toMatch(/getMobilePrimaryNavItems/);
    expect(SRC).not.toMatch(/getMobileMoreNavItems/);
    expect(SRC).not.toMatch(/isGlobalNavItemActive/);
  });

  it("owns identity sign-out only, awaiting signOut before navigating home", async () => {
    let resolveSignOut: (() => void) | undefined;
    signOut.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = resolve;
        }),
    );

    render(createElement(MobileTopBar));
    await openProfileMenu();

    const signOutItem = await screen.findByTestId("mobile-top-bar-sign-out");
    expect(within(signOutItem).getByText("Sign out")).toBeTruthy();
    // Identity overflow carries sign-out only — never a second route map.
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);

    fireEvent.click(signOutItem);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();

    resolveSignOut?.();
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith({ to: "/" });
    });
  });
});
