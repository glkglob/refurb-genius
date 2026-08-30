/**
 * Dashboard Home presentation — heading, Brief/Board order, rail.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

const useProjects = vi.fn();
const useDashboardProjectSummaries = vi.fn();
const useProjectBriefVisibility = vi.fn();

vi.mock("@/hooks/useProjects", () => ({
  useProjects: () => useProjects(),
}));

vi.mock("@/features/projects/presentation", () => ({
  useDashboardProjectSummaries: () => useDashboardProjectSummaries(),
  useProjectBriefVisibility: () => useProjectBriefVisibility(),
  ProjectBrief: () => createElement("section", { "data-testid": "project-brief" }, "brief"),
  WorkflowBoard: () => createElement("section", { "data-testid": "workflow-board" }, "board"),
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({
    children,
    showDealCopilotRail,
  }: {
    children: ReactNode;
    showDealCopilotRail?: boolean;
  }) =>
    createElement(
      "div",
      { "data-testid": "app-layout", "data-rail": String(Boolean(showDealCopilotRail)) },
      children,
    ),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: { component: unknown; head?: unknown }) => ({
    options: opts,
    path,
  }),
  Link: ({ children, to, ...rest }: { children?: ReactNode; to: string; [key: string]: unknown }) =>
    createElement("a", { href: to, ...rest }, children),
}));

import { Route } from "./dashboard";

const DashboardPage = Route.options.component as () => ReactNode;

describe("dashboard presentation", () => {
  beforeEach(() => {
    useProjects.mockReturnValue({
      data: [{ id: "p1", name: "A" }],
      isLoading: false,
      isPending: false,
      isError: false,
    });
    useDashboardProjectSummaries.mockReturnValue({
      status: "ready",
      summaries: [{ projectId: "p1", name: "A" }],
      error: null,
      retry: vi.fn(),
    });
    useProjectBriefVisibility.mockReturnValue({
      visible: true,
      hide: vi.fn(),
      restore: vi.fn(),
      resolvedUserId: "u1",
    });
  });

  it("keeps one h1, Brief before Board, and the Deal Copilot rail", () => {
    render(
      createElement(
        QueryClientProvider,
        { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        createElement(DashboardPage as never),
      ),
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(heading.className).toMatch(/\bfont-serif\b/);
    const brief = screen.getByTestId("project-brief");
    const board = screen.getByTestId("workflow-board");
    expect(brief.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("app-layout").getAttribute("data-rail")).toBe("true");
    expect(screen.getByTestId("dashboard-new-analysis").getAttribute("href")).toBe("/analyze");
    expect(
      screen.getByText("See what needs attention across your refurbishment projects."),
    ).toBeTruthy();
  });

  it("restores a compact Show Project Brief control when the brief is hidden", () => {
    useProjectBriefVisibility.mockReturnValue({
      visible: false,
      hide: vi.fn(),
      restore: vi.fn(),
      resolvedUserId: "u1",
    });
    render(
      createElement(
        QueryClientProvider,
        { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        createElement(DashboardPage as never),
      ),
    );
    expect(screen.queryByTestId("project-brief")).toBeNull();
    const restore = screen.getByTestId("project-brief-restore");
    expect(restore.textContent).toMatch(/Show Project Brief/);
    expect(restore.className).not.toMatch(/btn-primary-cta/);
    expect(screen.getByTestId("workflow-board")).toBeTruthy();
  });
});
