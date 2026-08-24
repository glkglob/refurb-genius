/**
 * Mobile A — bottom destination bar from canonical GLOBAL_NAV helpers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const signOut = vi.fn();
const navigate = vi.fn();
const toggleTheme = vi.fn();
let pathname = "/dashboard";

vi.mock("@/features/auth", () => ({
  useSignOut: () => ({
    signOut: (...args: unknown[]) => signOut(...args),
  }),
}));

vi.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    theme: "dark",
    resolvedTheme: "dark",
    setTheme: vi.fn(),
    toggleTheme: (...args: unknown[]) => toggleTheme(...args),
  }),
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  const MockLink = React.forwardRef<
    HTMLAnchorElement,
    { children?: React.ReactNode; to: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>
  >(function MockLink({ children, to, ...rest }, ref) {
    return React.createElement(
      "a",
      { href: typeof to === "string" ? to : "#", ...rest, ref },
      children,
    );
  });
  return {
    Link: MockLink,
    useNavigate: () => navigate,
    useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
      select({ location: { pathname } }),
  };
});

import { MobileBottomNav } from "./MobileBottomNav";

const SRC = readFileSync(join(__dirname, "MobileBottomNav.tsx"), "utf8");

beforeEach(() => {
  signOut.mockReset();
  navigate.mockReset();
  toggleTheme.mockReset();
  signOut.mockResolvedValue(undefined);
  pathname = "/dashboard";
});

async function openMoreMenu() {
  const trigger = screen.getByTestId("mobile-nav-more");
  await act(async () => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.pointerUp(trigger);
    fireEvent.click(trigger);
  });
  await screen.findByRole("menu");
}

function focusedMenuItem(): HTMLElement {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active.getAttribute("role") !== "menuitem") {
    throw new Error(
      `Expected a focused menuitem, received ${active instanceof HTMLElement ? `${active.tagName} role=${active.getAttribute("role")}` : String(active)}`,
    );
  }
  return active;
}

async function openMoreMenuFromKeyboard() {
  const trigger = screen.getByTestId("mobile-nav-more");
  trigger.focus();
  expect(trigger).toHaveFocus();
  await act(async () => {
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
  });
  const menu = await screen.findByRole("menu");
  await waitFor(() => {
    const active = document.activeElement;
    expect(active === menu || active?.getAttribute("role") === "menuitem").toBe(true);
  });
  return menu;
}

async function moveMenuFocus(key: "ArrowDown" | "ArrowUp") {
  const from = document.activeElement;
  expect(from).toBeInstanceOf(HTMLElement);
  await act(async () => {
    fireEvent.keyDown(from as HTMLElement, { key });
  });
  await waitFor(() => {
    expect(document.activeElement).not.toBe(from);
    expect(document.activeElement).toHaveAttribute("role", "menuitem");
  });
  return focusedMenuItem();
}

async function navigateArrowDownToToggleTheme() {
  const menu = await screen.findByRole("menu");
  if (document.activeElement === menu) {
    await moveMenuFocus("ArrowDown");
  }

  expect(focusedMenuItem()).toHaveAttribute("data-testid", "mobile-nav-trades_marketplace");
  expect(await moveMenuFocus("ArrowDown")).toHaveAttribute("data-testid", "mobile-nav-settings");
  const themeItem = await moveMenuFocus("ArrowDown");
  expect(themeItem).toHaveAttribute("data-testid", "mobile-nav-theme");
  expect(themeItem).toHaveAttribute("role", "menuitem");
  expect(themeItem).toHaveAccessibleName("Toggle theme");
  expect(themeItem).toHaveFocus();
  expect(themeItem).toHaveAttribute("data-highlighted");
  return themeItem;
}

describe("MobileBottomNav destinations", () => {
  it("exposes Home | Projects | New | Deal Copilot | More from canonical authority", () => {
    render(createElement(MobileBottomNav));
    expect(screen.getByTestId("mobile-nav-dashboard").getAttribute("href")).toBe("/dashboard");
    expect(screen.getByTestId("mobile-nav-projects").getAttribute("href")).toBe("/projects");
    expect(screen.getByTestId("mobile-nav-new_analysis").getAttribute("href")).toBe("/analyze");
    expect(screen.getByTestId("mobile-nav-deal_copilot").getAttribute("href")).toBe(
      "/deal-copilot",
    );
    expect(screen.getByTestId("mobile-nav-more")).toBeTruthy();
    expect(screen.getByTestId("mobile-nav-new_analysis").textContent).toMatch(/\+?\s*New/i);
    expect(screen.getByLabelText("Home")).toBeTruthy();
    expect(screen.getByLabelText("New Analysis")).toBeTruthy();
    expect(screen.getByLabelText("Deal Copilot")).toBeTruthy();
    expect(screen.getByText("Deal Copilot")).toBeTruthy();
    expect(screen.queryByText(/^Copilot$/)).toBeNull();
    expect(screen.queryByTestId("mobile-nav-trades_marketplace")).toBeNull();
    expect(screen.queryByText("Marketplace")).toBeNull();
  });

  it("exposes Marketplace and Settings through More menu", async () => {
    render(createElement(MobileBottomNav));
    await openMoreMenu();
    const marketplace = await screen.findByTestId("mobile-nav-trades_marketplace");
    const settings = await screen.findByTestId("mobile-nav-settings");
    expect(marketplace.getAttribute("href")).toBe("/marketplace");
    expect(settings.getAttribute("href")).toBe("/settings");
    expect(within(marketplace).getByText("Marketplace")).toBeTruthy();
    expect(within(marketplace).queryByText("Trades")).toBeNull();
    expect(within(settings).getByText("Settings")).toBeTruthy();
  });

  it("More menu surface uses shared bg-popover", async () => {
    render(createElement(MobileBottomNav));
    await openMoreMenu();
    const menu = await screen.findByRole("menu");
    expect(menu.className).toMatch(/\bbg-popover\b/);
    expect(menu.className).toMatch(/\btext-popover-foreground\b/);
    expect(menu.className).not.toMatch(/\bbg-transparent\b/);
    expect(menu.className).not.toMatch(/\bbg-white\b/);
    expect(menu.className).toMatch(/\bz-50\b/);
  });

  it("does not hard-code a second nav route map", () => {
    expect(SRC).toMatch(/getMobilePrimaryNavItems|getMobileMoreNavItems/);
    expect(SRC).toMatch(/@\/features\/navigation/);
    expect(SRC).not.toMatch(/to:\s*["']\/studies["']/);
  });

  it("marks Home active on /dashboard and New Analysis active on /analyze", () => {
    pathname = "/dashboard";
    const { unmount } = render(createElement(MobileBottomNav));
    expect(screen.getByTestId("mobile-nav-dashboard").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("mobile-nav-projects").getAttribute("data-active")).toBe("false");
    unmount();

    pathname = "/analyze";
    render(createElement(MobileBottomNav));
    expect(screen.getByTestId("mobile-nav-new_analysis").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("mobile-nav-projects").getAttribute("data-active")).toBe("false");
  });

  it("marks Projects active on selected-project routes", () => {
    pathname = "/projects/abc/upload";
    render(createElement(MobileBottomNav));
    expect(screen.getByTestId("mobile-nav-projects").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("mobile-nav-new_analysis").getAttribute("data-active")).toBe("false");
  });

  it("does not place Studies or stage labels in primary mobile nav", () => {
    render(createElement(MobileBottomNav));
    const primary = screen.getByTestId("mobile-bottom-nav").textContent ?? "";
    expect(primary).not.toMatch(/Studies/i);
    expect(primary).not.toMatch(/Photos|Analysis|Redesign|Estimate|Export/i);
  });

  it("exposes Theme as a More menuitem, not a sixth primary tab", async () => {
    render(createElement(MobileBottomNav));
    const bar = screen.getByTestId("mobile-bottom-nav");
    expect(bar.textContent ?? "").not.toMatch(/Theme/i);
    expect(within(bar).queryByTestId("mobile-nav-theme")).toBeNull();

    await openMoreMenu();
    const themeItem = screen.getByRole("menuitem", { name: "Toggle theme" });
    expect(themeItem.getAttribute("data-testid")).toBe("mobile-nav-theme");
    expect(themeItem.getAttribute("role")).toBe("menuitem");
    // Radix must own the item role; a raw button here would escape menu semantics.
    expect(screen.queryByRole("button", { name: "Toggle theme" })).toBeNull();
    // Opening More must not promote Theme into the destination row.
    expect(within(bar).queryByTestId("mobile-nav-theme")).toBeNull();
  });

  it("uses large-text friendly labels and owns the bottom safe-area", () => {
    expect(SRC).toMatch(/min-h-11/);
    expect(SRC).toMatch(/lg:hidden/);
    expect(SRC).toMatch(/safe-area-inset-bottom/);
    expect(SRC).not.toMatch(/text-\[10px\]/);
    expect(SRC).not.toMatch(/truncate/);
    expect(SRC).toMatch(/Deal Copilot/);
  });
});

describe("MobileBottomNav More menu keyboard", () => {
  it("lists More menu items in canonical order: Marketplace, Settings, Theme, Sign out", async () => {
    render(createElement(MobileBottomNav));
    await openMoreMenuFromKeyboard();
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.getAttribute("data-testid"))).toEqual([
      "mobile-nav-trades_marketplace",
      "mobile-nav-settings",
      "mobile-nav-theme",
      "mobile-nav-sign-out",
    ]);
    expect(items[0]!.getAttribute("href")).toBe("/marketplace");
    expect(within(items[0]!).getByText("Marketplace")).toBeTruthy();
    expect(within(items[0]!).queryByText("Trades")).toBeNull();
    expect(within(items[1]!).getByText("Settings")).toBeTruthy();
    expect(within(items[2]!).getByText("Theme")).toBeTruthy();
    expect(within(items[3]!).getByText("Sign out")).toBeTruthy();
  });

  it("moves actual Radix menu focus to Toggle theme with ArrowDown", async () => {
    render(createElement(MobileBottomNav));
    const menu = await openMoreMenuFromKeyboard();
    const initiallyFocused = document.activeElement;
    expect(initiallyFocused === menu || initiallyFocused?.getAttribute("role") === "menuitem").toBe(
      true,
    );

    const themeItem = await navigateArrowDownToToggleTheme();
    expect(themeItem).not.toBe(initiallyFocused);
    expect(document.activeElement).toBe(themeItem);
    expect(themeItem).toHaveFocus();
    expect(themeItem).toHaveAttribute("data-highlighted");
  });

  it("reaches Sign out with ArrowDown and returns to Toggle theme with ArrowUp", async () => {
    render(createElement(MobileBottomNav));
    await openMoreMenuFromKeyboard();
    const themeItem = await navigateArrowDownToToggleTheme();
    expect(themeItem).toHaveFocus();

    const signOutItem = await moveMenuFocus("ArrowDown");
    expect(signOutItem).toHaveAttribute("data-testid", "mobile-nav-sign-out");
    expect(signOutItem).toHaveAccessibleName("Sign out");
    expect(signOutItem).toHaveFocus();
    expect(signOutItem).toHaveAttribute("data-highlighted");
    expect(themeItem).not.toHaveFocus();

    const returned = await moveMenuFocus("ArrowUp");
    expect(returned).toBe(themeItem);
    expect(returned).toHaveAccessibleName("Toggle theme");
    expect(themeItem).toHaveFocus();
    expect(themeItem).toHaveAttribute("data-highlighted");
  });

  it("activates Toggle theme with Enter after genuine ArrowDown traversal", async () => {
    render(createElement(MobileBottomNav));
    await openMoreMenuFromKeyboard();
    toggleTheme.mockClear();
    const themeItem = await navigateArrowDownToToggleTheme();
    expect(toggleTheme).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.keyDown(themeItem, { key: "Enter" });
    });
    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });

  it("activates Toggle theme with Space after genuine ArrowDown traversal", async () => {
    render(createElement(MobileBottomNav));
    await openMoreMenuFromKeyboard();
    toggleTheme.mockClear();
    const themeItem = await navigateArrowDownToToggleTheme();
    expect(toggleTheme).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.keyDown(themeItem, { key: " " });
    });
    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });
});

describe("MobileBottomNav sign-out", () => {
  it("renders Sign out inside More menu with accessible label", async () => {
    render(createElement(MobileBottomNav));
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

    render(createElement(MobileBottomNav));
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
    const handler = SRC.match(
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
