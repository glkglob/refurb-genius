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
    showMobileTopBar,
  }: {
    children: ReactNode;
    showDealCopilotRail?: boolean;
    showMobileTopBar?: boolean;
  }) =>
    createElement(
      "div",
      {
        "data-testid": "app-layout",
        "data-rail": String(Boolean(showDealCopilotRail)),
        "data-mobile-top-bar": showMobileTopBar === false ? "false" : "true",
      },
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
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: "/dashboard" } }),
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

  it("keeps one h1, Brief before Board, and an in-page Deal Copilot path", () => {
    render(
      createElement(
        QueryClientProvider,
        { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        createElement(DashboardPage as never),
      ),
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const brief = screen.getByTestId("project-brief");
    const board = screen.getByTestId("workflow-board");
    expect(brief.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("app-layout").getAttribute("data-rail")).toBe("false");
    expect(screen.getByTestId("app-layout").getAttribute("data-mobile-top-bar")).toBe("false");
    expect(screen.getByTestId("dashboard-new-analysis").getAttribute("href")).toBe("/analyze");
    expect(screen.getByTestId("dashboard-deal-copilot-open").getAttribute("href")).toBe(
      "/deal-copilot",
    );
    expect(screen.queryByTestId("deal-copilot-rail")).toBeNull();
  });
});
