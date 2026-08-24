/**
 * IOS-DESIGN-COMPLETION — authenticated shell skip-link and bottom reserve.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("./RequireAuth", () => ({
  RequireAuth: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("./Sidebar", () => ({
  Sidebar: () => createElement("aside", { "data-testid": "sidebar" }),
}));

vi.mock("./MobileTopBar", () => ({
  MobileTopBar: () => createElement("div", { "data-testid": "mobile-top-bar" }),
}));

vi.mock("./MobileBottomNav", () => ({
  MobileBottomNav: () => createElement("nav", { "data-testid": "mobile-bottom-nav" }),
}));

vi.mock("./DealCopilotRail", () => ({
  DealCopilotRail: () => createElement("aside", { "data-testid": "deal-copilot-rail" }),
}));

vi.mock("./Footer", () => ({
  Footer: () => createElement("footer", { "data-testid": "app-footer" }, "footer"),
}));

import { AppLayout } from "./AppLayout";

const SRC = readFileSync(join(__dirname, "AppLayout.tsx"), "utf8");

describe("AppLayout iOS interaction chrome", () => {
  it("exposes a skip link to main content", () => {
    render(createElement(AppLayout, { title: "Dashboard", children: "body" }));
    const skip = screen.getByTestId("skip-to-main-content");
    expect(skip.getAttribute("href")).toBe("#main-content");
    expect(document.getElementById("main-content")).toBeTruthy();
  });

  it("uses min-h-dvh and bottom safe-area padding", () => {
    expect(SRC).toMatch(/min-h-dvh/);
    expect(SRC).toMatch(/env\(safe-area-inset-bottom/);
    expect(SRC).toMatch(/mobileBottomReserve/);
  });

  it("always mounts bottom nav and reserves space above it", () => {
    render(createElement(AppLayout, { title: "Dashboard", children: "body" }));
    expect(screen.getByTestId("mobile-bottom-nav")).toBeTruthy();
    expect(SRC).toMatch(/5\.75rem/);
    expect(SRC).toMatch(/lg:pb-10/);
    expect(SRC).not.toMatch(/md:flex/);
  });

  it("renders Deal Copilot rail only when requested", () => {
    const { rerender } = render(createElement(AppLayout, { children: "body" }));
    expect(screen.queryByTestId("deal-copilot-rail")).toBeNull();
    rerender(createElement(AppLayout, { showDealCopilotRail: true, children: "body" }));
    expect(screen.getByTestId("deal-copilot-rail")).toBeTruthy();
  });

  it("does not wrap the page header in glass-panel or a radial wash", () => {
    expect(SRC).not.toMatch(/glass-panel/);
    expect(SRC).not.toMatch(/radial-gradient/);
  });
});
