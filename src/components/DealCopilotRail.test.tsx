import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...rest }: { children?: ReactNode; to: string; [key: string]: unknown }) =>
    createElement("a", { href: typeof to === "string" ? to : "#", ...rest }, children),
}));

import { DealCopilotRail } from "./DealCopilotRail";

const SRC = readFileSync(join(__dirname, "DealCopilotRail.tsx"), "utf8");

describe("DealCopilotRail", () => {
  it("names Deal Copilot and links to the existing product route", () => {
    render(createElement(DealCopilotRail));
    expect(screen.getByRole("heading", { name: "Deal Copilot" })).toBeTruthy();
    expect(screen.getByTestId("deal-copilot-rail-open").getAttribute("href")).toBe("/deal-copilot");
    expect(screen.getByText(/Open Deal Copilot/)).toBeTruthy();
  });

  it("does not embed chat or invent Copilot APIs", () => {
    expect(SRC).not.toMatch(/DealChat|useSendDealChatMessage|useCreateDealThread/);
    expect(SRC).not.toMatch(/createServerFn|useMutation/);
    expect(SRC).toMatch(/to=["']\/deal-copilot["']/);
    expect(SRC).toMatch(/xl:flex/);
  });
});
