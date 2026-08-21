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
});
