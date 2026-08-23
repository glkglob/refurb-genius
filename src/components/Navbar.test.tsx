/**
 * IOS-UX-1B — marketing Navbar top safe-area contract.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const useAuth = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: (...args: unknown[]) => useAuth(...args),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...rest }: { children?: ReactNode; to: string; [key: string]: unknown }) =>
    createElement("a", { href: typeof to === "string" ? to : "#", ...rest }, children),
}));

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => createElement("div", { "data-testid": "theme-toggle" }),
}));

const setTheme = vi.fn();
const themeState: {
  theme: "light" | "dark" | "system";
  resolvedTheme: "light" | "dark";
  setTheme: (theme: "light" | "dark" | "system") => void;
  toggleTheme: () => void;
} = {
  theme: "dark",
  resolvedTheme: "dark",
  setTheme,
  toggleTheme: vi.fn(),
};

vi.mock("@/hooks/useTheme", () => ({
  useTheme: () => themeState,
}));

vi.mock("@/assets/brand/refurb-genius-wordmark-dark.svg?url", () => ({
  default: "/src/assets/brand/refurb-genius-wordmark-dark.svg",
}));
vi.mock("@/assets/brand/refurb-genius-wordmark-light.svg?url", () => ({
  default: "/src/assets/brand/refurb-genius-wordmark-light.svg",
}));

import { initialThemeState } from "@/components/ThemeProviderContext";
import { Navbar } from "./Navbar";

const SAFE_AREA_TOP_CLASS = "supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]";

beforeEach(() => {
  useAuth.mockReset();
  useAuth.mockReturnValue({ isAuthenticated: true });
  themeState.theme = "dark";
  themeState.resolvedTheme = "dark";
  themeState.setTheme = setTheme;
  document.documentElement.classList.remove("light", "dark");
});

describe("Navbar marketing safe-area", () => {
  it("applies the project safe-area top treatment on the header, not the h-16 row", () => {
    const src = readFileSync(join(__dirname, "Navbar.tsx"), "utf8");
    expect(src).toContain(SAFE_AREA_TOP_CLASS);
    expect(src).toMatch(
      /<header[\s\S]*supports-\[padding:max\(0px\)\]:pt-\[env\(safe-area-inset-top\)\][\s\S]*<div className="mx-auto flex h-16/,
    );
    expect(src).not.toMatch(
      /h-16[^"]*supports-\[padding:max\(0px\)\]:pt-\[env\(safe-area-inset-top\)\]/,
    );
  });

  it("renders the header with safe-area class and preserved row height", () => {
    render(createElement(Navbar));
    const header = screen.getByTestId("marketing-navbar");
    expect(header.className).toContain(SAFE_AREA_TOP_CLASS);
    expect(header.className).toMatch(/\bsticky\b/);
    expect(header.className).not.toMatch(/\bh-16\b/);
    const row = header.querySelector(".h-16");
    expect(row).toBeTruthy();
    expect(row?.className).not.toContain(SAFE_AREA_TOP_CLASS);
  });

  it("keeps marketing navigation controls present", () => {
    render(createElement(Navbar));
    expect(screen.getByTestId("marketing-nav-dashboard").getAttribute("href")).toBe("/dashboard");
    expect(screen.getByTestId("marketing-nav-menu").getAttribute("aria-label")).toBe("Toggle menu");
    expect(screen.getByRole("link", { name: "Refurb Genius home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Deal Copilot" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Trades" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Post Job" })).toBeTruthy();
  });

  it("uses the approved wordmark and does not use Building2 for identity", () => {
    const src = readFileSync(join(__dirname, "Navbar.tsx"), "utf8");
    expect(src).toMatch(/refurb-genius-wordmark-dark\.svg/);
    expect(src).toMatch(/refurb-genius-wordmark-light\.svg/);
    expect(src).not.toMatch(/Building2/);
    expect(src).not.toMatch(/Refurb<span/);
  });

  it("shows the dark-surface wordmark when resolvedTheme is dark", () => {
    themeState.resolvedTheme = "dark";
    render(createElement(Navbar));
    const home = screen.getByRole("link", { name: "Refurb Genius home" });
    const img = home.querySelector("img");
    expect(img?.getAttribute("src")).toMatch(/refurb-genius-wordmark-dark\.svg/);
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("shows the light-surface wordmark when resolvedTheme is light", () => {
    themeState.theme = "light";
    themeState.resolvedTheme = "light";
    render(createElement(Navbar));
    const img = screen.getByRole("link", { name: "Refurb Genius home" }).querySelector("img");
    expect(img?.getAttribute("src")).toMatch(/refurb-genius-wordmark-light\.svg/);
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("does not flash the light wordmark on html.dark before ThemeProvider mounts", () => {
    themeState.theme = "system";
    themeState.resolvedTheme = "light";
    themeState.setTheme = initialThemeState.setTheme;
    document.documentElement.classList.add("dark");
    render(createElement(Navbar));
    const img = screen.getByRole("link", { name: "Refurb Genius home" }).querySelector("img");
    expect(img?.getAttribute("src")).toMatch(/refurb-genius-wordmark-dark\.svg/);
  });

  it("opens the mobile menu from the hamburger without dropping desktop destinations", () => {
    render(createElement(Navbar));
    fireEvent.click(screen.getByTestId("marketing-nav-menu"));
    expect(screen.getByRole("link", { name: "Go to Dashboard" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Deal Copilot" }).length).toBeGreaterThan(1);
    expect(screen.getAllByRole("link", { name: "Dashboard" }).length).toBeGreaterThan(0);
  });
});
