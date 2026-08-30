import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const useProjects = vi.fn();
const routerState = { pathname: "/projects" };

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...rest }: { children?: ReactNode; to: string; [key: string]: unknown }) =>
    createElement("a", { href: typeof to === "string" ? to : "#", ...rest }, children),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown;
  }) => select({ location: { pathname: routerState.pathname } }),
}));

vi.mock("@/hooks/useProjects", () => ({
  useProjects: (...args: unknown[]) => useProjects(...args),
}));

vi.mock("@/features/ai-upload", () => ({
  usePhotos: () => ({ data: [] }),
  useProjectPhotoDisplayUrl: () => ({ data: undefined }),
}));

vi.mock("@/features/projects", () => ({
  useProjectFiveStageWorkflow: () => ({
    loading: false,
    nextAction: { status: "Ready" },
    shellProgress: null,
  }),
}));

import { DealCopilotRail } from "./DealCopilotRail";

const SRC = readFileSync(join(__dirname, "DealCopilotRail.tsx"), "utf8");

function project(id: string, name: string) {
  return { id, name, address: `${name} Street`, postcode: "E1 1AA", region: "London" };
}

beforeEach(() => {
  routerState.pathname = "/projects";
  useProjects.mockReset();
  useProjects.mockReturnValue({ data: [] });
});

describe("DealCopilotRail", () => {
  it("names Deal Copilot and links to the existing product route", () => {
    render(createElement(DealCopilotRail));
    const heading = screen.getByRole("heading", { name: "Deal Copilot" });
    expect(heading).toBeTruthy();
    expect(heading.className).not.toMatch(/\bfont-serif\b/);
    expect(screen.getByTestId("deal-copilot-rail-open").getAttribute("href")).toBe("/deal-copilot");
    expect(screen.getByText("Ask about a project")).toBeTruthy();
    expect(screen.getByText(/does not replace/i)).toBeTruthy();
    expect(screen.queryByTestId("recent-projects")).toBeNull();
  });

  it("shows at most five Recent projects from the existing Projects list", () => {
    useProjects.mockReturnValue({
      data: [
        project("p1", "One"),
        project("p2", "Two"),
        project("p3", "Three"),
        project("p4", "Four"),
        project("p5", "Five"),
        project("p6", "Six"),
      ],
    });
    render(createElement(DealCopilotRail));
    expect(screen.getByTestId("recent-projects")).toBeTruthy();
    expect(screen.getByText("Recent projects")).toBeTruthy();
    expect(screen.getByTestId("recent-project-p1")).toBeTruthy();
    expect(screen.getByTestId("recent-project-p5")).toBeTruthy();
    expect(screen.queryByTestId("recent-project-p6")).toBeNull();
    expect(useProjects).toHaveBeenCalled();
  });

  it("does not show Recent projects on Dashboard", () => {
    routerState.pathname = "/dashboard";
    useProjects.mockReturnValue({
      data: [project("p1", "One"), project("p2", "Two")],
    });
    render(createElement(DealCopilotRail));
    expect(screen.queryByTestId("recent-projects")).toBeNull();
    expect(screen.queryByTestId("recent-project-p1")).toBeNull();
    expect(useProjects).not.toHaveBeenCalled();
  });

  it("does not embed chat or invent Copilot APIs", () => {
    expect(SRC).not.toMatch(/DealChat|useSendDealChatMessage|useCreateDealThread/);
    expect(SRC).not.toMatch(/createServerFn|useMutation/);
    expect(SRC).toMatch(/to=["']\/deal-copilot["']/);
    expect(SRC).toMatch(/Ask about a project/);
    expect(SRC).not.toMatch(/isDashboardPath/);
    expect(SRC).toMatch(/isProjectsIndexPath/);
    expect(SRC).toMatch(/xl:flex/);
    expect(SRC).toMatch(/\bhidden w-64 shrink-0\b/);
    expect(SRC).toMatch(/\bmax-w-full\b/);
    expect(SRC).toMatch(/\bmin-w-0\b/);
    expect(SRC).not.toMatch(/\bw-72\b/);
    expect(SRC).toMatch(/useProjects/);
    expect(SRC).toMatch(/slice\(0,\s*RECENT_LIMIT\)/);
    expect(SRC).not.toMatch(/updated_at|updatedAt|activity timestamp/);
  });
});
