/**
 * Dashboard Home — Brief + Board composition, not My projects.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const useProjects = vi.fn();
const useDashboardProjectSummaries = vi.fn();
const useProjectBriefVisibility = vi.fn();

vi.mock("@/hooks/useProjects", () => ({
  useProjects: (...args: unknown[]) => useProjects(...args),
}));

vi.mock("@/features/projects/presentation", () => ({
  useDashboardProjectSummaries: (...args: unknown[]) => useDashboardProjectSummaries(...args),
  useProjectBriefVisibility: (...args: unknown[]) => useProjectBriefVisibility(...args),
  ProjectBrief: ({ summaries }: { summaries: Array<{ name: string }> }) =>
    createElement("div", { "data-testid": "project-brief" }, summaries[0]?.name ?? "brief"),
  WorkflowBoard: ({ summaries }: { summaries: Array<{ name: string }> }) =>
    createElement("div", { "data-testid": "workflow-board" }, `${summaries.length} columns`),
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
        "data-rail": showDealCopilotRail ? "true" : "false",
        "data-mobile-top-bar": showMobileTopBar === false ? "false" : "true",
      },
      children,
    ),
}));

vi.mock("@/components/EmptyState", () => ({
  EmptyState: ({ title, action }: { title: string; action?: ReactNode }) =>
    createElement("div", { "data-testid": "empty" }, title, action),
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
const ROUTE_SRC = join(__dirname, "dashboard.tsx");

function renderDashboard() {
  return render(
    createElement(
      QueryClientProvider,
      { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
      createElement(DashboardPage as never),
    ),
  );
}

const terrace = { id: "p1", name: "22 Kensington Road" };

beforeEach(() => {
  useProjects.mockReset();
  useDashboardProjectSummaries.mockReset();
  useProjectBriefVisibility.mockReset();
  useProjects.mockReturnValue({
    data: [terrace],
    isLoading: false,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  });
  useDashboardProjectSummaries.mockReturnValue({
    status: "ready",
    summaries: [
      {
        projectId: "p1",
        name: "22 Kensington Road",
        stage: "photos",
        workflowRoute: "/projects/p1/upload",
      },
    ],
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

describe("dashboard Home/Dashboard composition", () => {
  it("renders Home/Dashboard heading, document title, and New Analysis", () => {
    renderDashboard();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toMatch(/Home/);
    expect(heading.textContent).toMatch(/Dashboard/);
    expect(heading.querySelectorAll("span")).toHaveLength(2);
    expect(screen.getByTestId("dashboard-new-analysis").getAttribute("href")).toBe("/analyze");
    const head = (Route.options as { head?: () => { meta?: Array<{ title?: string }> } }).head;
    expect(head?.().meta?.[0]?.title).toBe("Dashboard — Refurb Genius");
  });

  it("renders Project Brief before Workflow Board", () => {
    renderDashboard();
    const brief = screen.getByTestId("project-brief");
    const board = screen.getByTestId("workflow-board");
    expect(brief.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("app-layout").getAttribute("data-rail")).toBe("false");
    expect(screen.getByTestId("app-layout").getAttribute("data-mobile-top-bar")).toBe("false");
    expect(screen.getByTestId("dashboard-deal-copilot-open").getAttribute("href")).toBe(
      "/deal-copilot",
    );
    expect(screen.queryByTestId("deal-copilot-rail")).toBeNull();
  });

  it("does not render My projects, featured hierarchy, search, or continuation cards", () => {
    renderDashboard();
    expect(screen.queryByRole("heading", { name: "My projects" })).toBeNull();
    expect(screen.queryByText("Continue where you left off")).toBeNull();
    expect(screen.queryByText("Other projects")).toBeNull();
    expect(screen.queryByTestId("dashboard-project-search")).toBeNull();
    const src = readFileSync(ROUTE_SRC, "utf8");
    expect(src).not.toMatch(/My projects/);
    expect(src).not.toMatch(/ProjectContinuationCard/);
    expect(src).not.toMatch(/layout="featured"/);
    expect(src).not.toMatch(/photos_done/);
  });

  it("shows list loading, list error, and empty states", () => {
    useProjects.mockReturnValue({
      data: [],
      isLoading: true,
      isPending: true,
      isError: false,
    });
    const { unmount } = renderDashboard();
    expect(screen.getByText("Loading your projects…")).toBeTruthy();
    unmount();

    useProjects.mockReturnValue({
      data: [],
      isLoading: false,
      isPending: false,
      isError: true,
      error: new Error("list failed"),
      refetch: vi.fn(),
    });
    const errorRender = renderDashboard();
    expect(screen.getByTestId("empty").textContent).toMatch(/Could not load projects/);
    errorRender.unmount();

    useProjects.mockReturnValue({
      data: [],
      isLoading: false,
      isPending: false,
      isError: false,
    });
    renderDashboard();
    expect(screen.getByTestId("empty").textContent).toMatch(/No projects yet/);
  });

  it("shows workflow loading and retryable workflow error", () => {
    const retry = vi.fn();
    useDashboardProjectSummaries.mockReturnValue({
      status: "loading",
      summaries: [],
      error: null,
      retry,
    });
    const { unmount } = renderDashboard();
    expect(screen.getByTestId("dashboard-workflow-loading")).toBeTruthy();
    unmount();

    useDashboardProjectSummaries.mockReturnValue({
      status: "error",
      summaries: [],
      error: new Error("workflow failed"),
      retry,
    });
    renderDashboard();
    expect(screen.getByTestId("empty").textContent).toMatch(/Could not load workflow/);
    fireEvent.click(screen.getByTestId("dashboard-workflow-retry"));
    expect(retry).toHaveBeenCalled();
  });

  it("shows restore control and board when the brief is hidden", () => {
    const restore = vi.fn();
    useProjectBriefVisibility.mockReturnValue({
      visible: false,
      hide: vi.fn(),
      restore,
      resolvedUserId: "u1",
    });
    renderDashboard();
    expect(screen.queryByTestId("project-brief")).toBeNull();
    fireEvent.click(screen.getByTestId("project-brief-restore"));
    expect(restore).toHaveBeenCalled();
    expect(screen.getByTestId("workflow-board")).toBeTruthy();
    expect(screen.queryByTestId("project-brief-hide")).toBeNull();
  });

  it("renders at most five Recent projects in existing listOrder with overview routes", () => {
    useProjects.mockReturnValue({
      data: Array.from({ length: 7 }, (_, index) => ({
        id: `p${index}`,
        name: `Project ${index}`,
      })),
      isLoading: false,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    useDashboardProjectSummaries.mockReturnValue({
      status: "ready",
      summaries: [
        {
          projectId: "p5",
          name: "Sixth newest",
          listOrder: 5,
          overviewRoute: "/projects/p5",
          workflowRoute: "/projects/p5/upload",
        },
        {
          projectId: "p1",
          name: "Second newest",
          listOrder: 1,
          overviewRoute: "/projects/p1",
          workflowRoute: "/projects/p1/upload",
        },
        {
          projectId: "p0",
          name: "Newest created",
          listOrder: 0,
          overviewRoute: "/projects/p0",
          workflowRoute: "/projects/p0/upload",
        },
        {
          projectId: "p3",
          name: "Fourth newest",
          listOrder: 3,
          overviewRoute: "/projects/p3",
          workflowRoute: "/projects/p3/upload",
        },
        {
          projectId: "p6",
          name: "Seventh newest",
          listOrder: 6,
          overviewRoute: "/projects/p6",
          workflowRoute: "/projects/p6/upload",
        },
        {
          projectId: "p2",
          name: "Third newest",
          listOrder: 2,
          overviewRoute: "/projects/p2",
          workflowRoute: "/projects/p2/upload",
        },
        {
          projectId: "p4",
          name: "Fifth newest",
          listOrder: 4,
          overviewRoute: "/projects/p4",
          workflowRoute: "/projects/p4/upload",
        },
      ],
      error: null,
      retry: vi.fn(),
    });

    renderDashboard();

    const recent = screen.getByTestId("dashboard-recent-projects");
    const rendered = [
      "dashboard-recent-project-p0",
      "dashboard-recent-project-p1",
      "dashboard-recent-project-p2",
      "dashboard-recent-project-p3",
      "dashboard-recent-project-p4",
    ].map((id) => screen.getByTestId(id));

    expect(recent.querySelectorAll("[data-testid^='dashboard-recent-project-']")).toHaveLength(5);
    expect(screen.queryByTestId("dashboard-recent-project-p5")).toBeNull();
    expect(screen.queryByTestId("dashboard-recent-project-p6")).toBeNull();

    for (let i = 1; i < rendered.length; i += 1) {
      expect(
        Boolean(
          rendered[i - 1]!.compareDocumentPosition(rendered[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ).toBe(true);
    }

    expect(screen.getByTestId("dashboard-recent-project-p0").getAttribute("href")).toBe(
      "/projects/p0",
    );
    expect(screen.getByTestId("dashboard-recent-project-p4").getAttribute("href")).toBe(
      "/projects/p4",
    );

    const src = readFileSync(ROUTE_SRC, "utf8");
    expect(src).toMatch(/listOrder/);
    expect(src).toMatch(/\.slice\(\s*0\s*,\s*5\s*\)/);
    expect(src).toMatch(/overviewRoute/);
    expect(src).not.toMatch(/updated_at/);
    expect(src).not.toMatch(/last viewed|lastViewed|lastOpened|last_active/);
  });

  it("opens a Dashboard-only hamburger sheet of existing destinations", () => {
    renderDashboard();
    const trigger = screen.getByTestId("dashboard-mobile-nav-trigger");
    expect(trigger.getAttribute("aria-label")).toBe("Open navigation");
    fireEvent.click(trigger);
    expect(screen.getByTestId("dashboard-mobile-nav-dashboard").getAttribute("href")).toBe(
      "/dashboard",
    );
    expect(screen.getByTestId("dashboard-mobile-nav-projects").getAttribute("href")).toBe(
      "/projects",
    );
    expect(screen.getByTestId("dashboard-mobile-nav-new_analysis").getAttribute("href")).toBe(
      "/analyze",
    );
    expect(screen.getByTestId("dashboard-mobile-nav-deal_copilot").getAttribute("href")).toBe(
      "/deal-copilot",
    );
    expect(screen.getByTestId("dashboard-mobile-nav-trades_marketplace").getAttribute("href")).toBe(
      "/marketplace",
    );
    expect(screen.getByTestId("dashboard-mobile-nav-settings").getAttribute("href")).toBe(
      "/settings",
    );
    expect(screen.queryByTestId("global-nav-dashboard")).toBeNull();
    expect(screen.queryByTestId("dashboard-mobile-nav-sign-out")).toBeNull();
    expect(screen.queryByText("Sign out")).toBeNull();
  });
});
