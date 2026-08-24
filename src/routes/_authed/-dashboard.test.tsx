/**
 * RG-20260824-DESIGN-CONFORMANCE-R1 — dashboard is project-first My projects.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const useProjects = vi.fn();

vi.mock("@/hooks/useProjects", () => ({
  useProjects: (...args: unknown[]) => useProjects(...args),
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode; showDealCopilotRail?: boolean }) =>
    createElement("div", { "data-testid": "app-layout" }, children),
}));

vi.mock("@/features/projects", () => ({
  ProjectContinuationCard: ({
    layout,
    project,
  }: {
    layout?: string;
    project: { id: string; name: string };
  }) =>
    createElement(
      "div",
      { "data-testid": "project-card", "data-layout": layout, "data-project-id": project.id },
      project.name,
    ),
}));

vi.mock("@/components/EmptyState", () => ({
  EmptyState: ({ title }: { title: string }) =>
    createElement("div", { "data-testid": "empty" }, title),
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

function renderDashboard(qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    createElement(QueryClientProvider, { client: qc }, createElement(DashboardPage as never)),
  );
}

const terrace = {
  id: "p1",
  name: "22 Kensington Road",
  address: "22 Kensington Road",
  postcode: "W8 5AB",
  region: "London",
  photos_done: true,
  analysis_done: true,
  estimate_done: false,
  report_done: false,
};
const other = {
  id: "p2",
  name: "45 Oakwood Avenue",
  address: "45 Oakwood Avenue",
  postcode: "HA5 3AA",
  region: "London",
  photos_done: true,
  analysis_done: true,
  estimate_done: true,
  report_done: true,
};

beforeEach(() => {
  useProjects.mockReset();
  useProjects.mockReturnValue({ data: [terrace, other], isLoading: false });
});

describe("dashboard My projects composition", () => {
  it("renders My projects heading and one New Analysis action", () => {
    renderDashboard();
    expect(screen.getByRole("heading", { name: "My projects" })).toBeTruthy();
    expect(screen.getByTestId("dashboard-new-analysis").getAttribute("href")).toBe("/analyze");
  });

  it("features the first filtered project and lists others as rows", () => {
    renderDashboard();
    expect(screen.getByText("Continue where you left off")).toBeTruthy();
    expect(screen.getByTestId("dashboard-featured-project").textContent).toMatch(
      /22 Kensington Road/,
    );
    expect(screen.getByTestId("dashboard-project-rows").textContent).toMatch(/45 Oakwood Avenue/);
  });

  it("does not use legacy progress flags to choose the featured project", () => {
    useProjects.mockReturnValue({ data: [other, terrace], isLoading: false });
    renderDashboard();
    expect(screen.getByTestId("dashboard-featured-project").textContent).toMatch(
      /45 Oakwood Avenue/,
    );
    expect(screen.getByTestId("dashboard-project-rows").textContent).toMatch(/22 Kensington Road/);
    const src = readFileSync(ROUTE_SRC, "utf8");
    expect(src).not.toMatch(/isProjectInProgress/);
    expect(src).not.toMatch(/photos_done/);
    expect(src).not.toMatch(/analysis_done/);
    expect(src).not.toMatch(/estimate_done/);
    expect(src).not.toMatch(/report_done/);
    expect(src).toMatch(/filtered\[0\]/);
  });

  it("filters projects from existing list fields only", () => {
    renderDashboard();
    fireEvent.change(screen.getByTestId("dashboard-project-search"), {
      target: { value: "Oakwood" },
    });
    expect(screen.getByTestId("dashboard-featured-project").textContent).toMatch(
      /45 Oakwood Avenue/,
    );
    expect(screen.queryByText("22 Kensington Road")).toBeNull();
  });

  it("does not first-paint trades, studies, onboarding, or a quick-action grid", () => {
    const src = readFileSync(ROUTE_SRC, "utf8");
    renderDashboard();
    expect(screen.queryByText(/Welcome/)).toBeNull();
    expect(screen.queryByText(/Quick actions/)).toBeNull();
    expect(screen.queryByText(/My trades jobs/)).toBeNull();
    expect(screen.queryByText(/My Jobs/)).toBeNull();
    expect(screen.queryByText(/My Interests/)).toBeNull();
    expect(screen.queryByText(/Feasibility snapshots/)).toBeNull();
    expect(src).not.toMatch(/listCurrentUserTradesJobs/);
    expect(src).not.toMatch(/listCurrentUserInterestsWithJobs/);
    expect(src).not.toMatch(/updateTradesJob/);
    expect(src).not.toMatch(/useOnboardingGoalSelection/);
    expect(src).not.toMatch(/QuickActionCard/);
    expect(src).not.toMatch(/dashboard-studies-secondary/);
    expect(src).not.toMatch(/dashboard-commercial-metrics/);
    expect(src).not.toMatch(/commercialStats/);
    expect(src).toMatch(/showDealCopilotRail/);
  });

  it("keeps ProjectContinuationCard as the next-action authority with one featured CTA", () => {
    renderDashboard();
    const src = readFileSync(ROUTE_SRC, "utf8");
    expect(src).toMatch(/ProjectContinuationCard/);
    expect(src).toMatch(/layout="featured"/);
    expect(src).not.toMatch(/resolveProjectNextAction/);
    expect(src).not.toMatch(/useProjectFiveStageWorkflow/);
    expect(src).not.toMatch(/Open overview/);
    expect(screen.getAllByTestId("dashboard-new-analysis")).toHaveLength(1);
  });
});
