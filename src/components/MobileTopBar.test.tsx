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

vi.mock("@/assets/brand/refurb-genius-mark.svg?url", () => ({
  default: "/src/assets/brand/refurb-genius-mark.svg",
}));
vi.mock("@/assets/brand/refurb-genius-mark-light.svg?url", () => ({
  default: "/src/assets/brand/refurb-genius-mark-light.svg",
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

import { MobileTopBar } from "./MobileTopBar";

beforeEach(() => {
  signOut.mockReset();
  navigate.mockReset();
  toggleTheme.mockReset();
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

const SAFE_AREA_TOP_CLASS = "supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]";

describe("MobileTopBar safe-area (IOS-DESIGN-COMPLETION)", () => {
  it("applies top inset on the header, not the h-14 row", () => {
    const src = readFileSync(join(__dirname, "MobileTopBar.tsx"), "utf8");
    expect(src).toContain(SAFE_AREA_TOP_CLASS);
    expect(src).toMatch(
      /<header[\s\S]*supports-\[padding:max\(0px\)\]:pt-\[env\(safe-area-inset-top\)\][\s\S]*mobile-top-bar-row/,
    );
    expect(src).not.toMatch(
      /h-14[^"]*supports-\[padding:max\(0px\)\]:pt-\[env\(safe-area-inset-top\)\]/,
    );
  });

  it("renders header with safe-area class and preserved row height", () => {
    render(createElement(MobileTopBar));
    const header = screen.getByTestId("mobile-top-bar");
    expect(header.className).toContain(SAFE_AREA_TOP_CLASS);
    expect(header.className).not.toMatch(/(?:^|\s)h-14(?:\s|$)/);
    expect(screen.getByTestId("mobile-top-bar-row").className).toMatch(/(?:^|\s)h-14(?:\s|$)/);
  });

  it("exposes a Theme menuitem in More, not a sixth primary tab", async () => {
    render(createElement(MobileTopBar));
    const primary = screen.getByTestId("mobile-primary-nav").textContent ?? "";
    expect(primary).not.toMatch(/Theme/i);
    await openMoreMenu();
    const themeItem = screen.getByRole("menuitem", { name: "Toggle theme" });
    expect(themeItem.getAttribute("data-testid")).toBe("mobile-nav-theme");
    expect(themeItem.getAttribute("role")).toBe("menuitem");
    expect(screen.queryByRole("button", { name: "Toggle theme" })).toBeNull();
  });

  it("reaches the Theme menuitem with arrow keys and activates it from the keyboard", async () => {
    render(createElement(MobileTopBar));
    await openMoreMenuFromKeyboard();
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.getAttribute("data-testid"))).toEqual([
      "mobile-nav-trades_marketplace",
      "mobile-nav-settings",
      "mobile-nav-theme",
      "mobile-nav-sign-out",
    ]);
    const themeItem = screen.getByRole("menuitem", { name: "Toggle theme" });
    expect(themeItem).toHaveAttribute("role", "menuitem");
    expect(themeItem.tabIndex).toBeGreaterThanOrEqual(-1);

    expect(toggleTheme).not.toHaveBeenCalled();
    await navigateArrowDownToToggleTheme();
    expect(document.activeElement).toBe(themeItem);
    expect(themeItem).toHaveFocus();

    await act(async () => {
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Enter" });
    });
    expect(toggleTheme).toHaveBeenCalledTimes(1);

    toggleTheme.mockClear();
    await openMoreMenuFromKeyboard();
    await navigateArrowDownToToggleTheme();
    await act(async () => {
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: " " });
    });
    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });

  it("moves actual Radix menu focus to Toggle theme with ArrowDown", async () => {
    render(createElement(MobileTopBar));
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

  it("returns actual Radix menu focus to Toggle theme with ArrowUp", async () => {
    render(createElement(MobileTopBar));
    await openMoreMenuFromKeyboard();
    const themeItem = await navigateArrowDownToToggleTheme();
    expect(themeItem).toHaveFocus();

    const signOutItem = await moveMenuFocus("ArrowDown");
    expect(signOutItem).toHaveAttribute("data-testid", "mobile-nav-sign-out");
    expect(signOutItem).toHaveFocus();
    expect(themeItem).not.toHaveFocus();

    const returned = await moveMenuFocus("ArrowUp");
    expect(returned).toBe(themeItem);
    expect(returned).toHaveAccessibleName("Toggle theme");
    expect(themeItem).toHaveFocus();
    expect(themeItem).toHaveAttribute("data-highlighted");
  });

  it("activates Toggle theme with Enter after genuine ArrowDown traversal", async () => {
    render(createElement(MobileTopBar));
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
    render(createElement(MobileTopBar));
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

describe("MobileTopBar brand identity (IOS-BRAND-ASSETS-1)", () => {
  it("names the home control Refurb Genius home and keeps the mark decorative", () => {
    render(createElement(MobileTopBar));
    const home = screen.getByTestId("mobile-nav-brand");
    expect(home.getAttribute("aria-label")).toBe("Refurb Genius home");
    expect(home.getAttribute("href")).toBe("/dashboard");
    const imgs = home.querySelectorAll("img");
    expect(imgs.length).toBe(2);
    imgs.forEach((img) => {
      expect(img.getAttribute("alt")).toBe("");
    });
    expect(screen.getByRole("link", { name: "Refurb Genius home" })).toBe(home);
  });

  it("uses the approved compact family and does not use Building2 for identity", () => {
    const src = readFileSync(join(__dirname, "MobileTopBar.tsx"), "utf8");
    expect(src).toMatch(/refurb-genius-mark\.svg/);
    expect(src).toMatch(/refurb-genius-mark-light\.svg/);
    expect(src).not.toMatch(/Building2/);
  });
});

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

  it("exposes Trades and Settings through More menu", async () => {
    render(createElement(MobileTopBar));
    await openMoreMenu();
    const trades = await screen.findByTestId("mobile-nav-trades_marketplace");
    const settings = await screen.findByTestId("mobile-nav-settings");
    expect(trades.getAttribute("href")).toBe("/trades");
    expect(settings.getAttribute("href")).toBe("/settings");
    expect(within(trades).getByText("Trades")).toBeTruthy();
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
