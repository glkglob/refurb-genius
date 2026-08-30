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
  }: {
    children: ReactNode;
    showDealCopilotRail?: boolean;
  }) =>
    createElement(
      "div",
      { "data-testid": "app-layout", "data-rail": showDealCopilotRail ? "true" : "false" },
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
    expect(
      screen.getByText("See what needs attention across your refurbishment projects."),
    ).toBeTruthy();
    const head = (Route.options as { head?: () => { meta?: Array<{ title?: string }> } }).head;
    expect(head?.().meta?.[0]?.title).toBe("Dashboard — Refurb Genius");
  });

  it("renders Project Brief before Workflow Board", () => {
    renderDashboard();
    const brief = screen.getByTestId("project-brief");
    const board = screen.getByTestId("workflow-board");
    expect(brief.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("app-layout").getAttribute("data-rail")).toBe("true");
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
    const restoreControl = screen.getByTestId("project-brief-restore");
    fireEvent.click(restoreControl);
    expect(restore).toHaveBeenCalled();
    expect(screen.getByTestId("workflow-board")).toBeTruthy();
    expect(restoreControl.tagName).toBe("BUTTON");
    expect(restoreControl.className).not.toMatch(/btn-primary-cta/);
    expect(restoreControl.textContent).toMatch(/Show Project Brief/);
  });
});
