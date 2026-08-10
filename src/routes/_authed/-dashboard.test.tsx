/**
 * AO-1D2 — Dashboard uses canonical onboarding goal hook; no direct Supabase Auth.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const hydrateOnboardingGoal = vi.fn();
const applyOnboardingGoal = vi.fn();
const useOnboardingGoalSelection = vi.fn();
const consumeNewUserOnboarding = vi.fn();
const hasCompletedFirstStudy = vi.fn();
const useAuth = vi.fn();
const useProjects = vi.fn();
const listCurrentUserTradesJobs = vi.fn();
const listCurrentUserInterestsWithJobs = vi.fn();

vi.mock("@/features/auth", () => ({
  useOnboardingGoalSelection: (...args: unknown[]) => useOnboardingGoalSelection(...args),
  consumeNewUserOnboarding: (...args: unknown[]) => consumeNewUserOnboarding(...args),
  hasCompletedFirstStudy: (...args: unknown[]) => hasCompletedFirstStudy(...args),
  ONBOARDING_GOAL_OPTIONS: [
    "Run my first feasibility study",
    "Estimate refurb costs on a project",
    "Model ROI for an investment deal",
    "Prepare an investor report export",
  ],
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: (...args: unknown[]) => useAuth(...args),
}));

vi.mock("@/hooks/useProjects", () => ({
  useProjects: (...args: unknown[]) => useProjects(...args),
}));

vi.mock("@/features/trades", () => ({
  listCurrentUserTradesJobs: (...args: unknown[]) => listCurrentUserTradesJobs(...args),
  listCurrentUserInterestsWithJobs: (...args: unknown[]) =>
    listCurrentUserInterestsWithJobs(...args),
  updateTradesJob: vi.fn(),
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({
    children,
    title,
    subtitle,
  }: {
    children: ReactNode;
    title: string;
    subtitle: string;
  }) =>
    createElement(
      "div",
      { "data-testid": "app-layout", "data-title": title, "data-subtitle": subtitle },
      children,
    ),
}));

vi.mock("@/components/DashboardSection", () => ({
  DashboardSection: ({
    children,
    title,
  }: {
    children: ReactNode;
    title: string;
    icon?: ReactNode;
    action?: ReactNode;
  }) => createElement("section", { "data-testid": `section-${title}` }, children),
}));

vi.mock("@/features/projects", () => ({
  ProjectContinuationCard: () => createElement("div", { "data-testid": "project-card" }),
}));

vi.mock("@/components/EmptyState", () => ({
  EmptyState: ({ title }: { title: string }) =>
    createElement("div", { "data-testid": "empty" }, title),
}));

vi.mock("@/components/StatusBadge", () => ({
  StatusBadge: ({ children }: { children: ReactNode }) =>
    createElement("span", { "data-testid": "status-badge" }, children),
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

beforeEach(() => {
  hydrateOnboardingGoal.mockReset();
  applyOnboardingGoal.mockReset();
  applyOnboardingGoal.mockResolvedValue(undefined);
  useOnboardingGoalSelection.mockReset();
  useOnboardingGoalSelection.mockReturnValue({
    onboardingGoal: "Run my first feasibility study",
    isSaving: false,
    hydrateOnboardingGoal,
    applyOnboardingGoal,
  });
  consumeNewUserOnboarding.mockReset();
  consumeNewUserOnboarding.mockReturnValue(true);
  hasCompletedFirstStudy.mockReset();
  hasCompletedFirstStudy.mockReturnValue(false);
  useAuth.mockReset();
  useAuth.mockReturnValue({
    user: { fullName: "Ada Lovelace", id: "u1" },
    isLoading: false,
  });
  useProjects.mockReset();
  useProjects.mockReturnValue({ data: [], isLoading: false });
  listCurrentUserTradesJobs.mockReset();
  listCurrentUserTradesJobs.mockResolvedValue([]);
  listCurrentUserInterestsWithJobs.mockReset();
  listCurrentUserInterestsWithJobs.mockResolvedValue([]);
});

describe("dashboard onboarding Auth extraction", () => {
  it("uses useOnboardingGoalSelection and hydrates on mount", () => {
    renderDashboard();
    expect(useOnboardingGoalSelection).toHaveBeenCalled();
    expect(hydrateOnboardingGoal).toHaveBeenCalled();
    expect(consumeNewUserOnboarding).toHaveBeenCalled();
    expect(hasCompletedFirstStudy).toHaveBeenCalled();
  });

  it("renders onboarding select from hook value and goal options", () => {
    renderDashboard();
    const select = screen.getByLabelText(/What do you want to do first/i) as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe("Run my first feasibility study");
    expect(screen.getByRole("option", { name: "Run my first feasibility study" })).toBeTruthy();
  });

  it("calls applyOnboardingGoal when select changes", () => {
    renderDashboard();
    const select = screen.getByLabelText(/What do you want to do first/i);
    fireEvent.change(select, { target: { value: "Model ROI for an investment deal" } });
    expect(applyOnboardingGoal).toHaveBeenCalledWith("Model ROI for an investment deal");
  });

  it("disables select while goal is saving", () => {
    useOnboardingGoalSelection.mockReturnValue({
      onboardingGoal: "Run my first feasibility study",
      isSaving: true,
      hydrateOnboardingGoal,
      applyOnboardingGoal,
    });
    renderDashboard();
    const select = screen.getByLabelText(/What do you want to do first/i) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it("shows new-user welcome card when consume flag is true", () => {
    renderDashboard();
    expect(screen.getByText(/Welcome, Ada/)).toBeTruthy();
  });

  it("PH-TRUTH-R1: Study completion checks optional snapshot, not Estimate/Export label", () => {
    hasCompletedFirstStudy.mockReturnValue(true);
    renderDashboard();
    expect(screen.getByText(/Optional: create a feasibility snapshot/i)).toBeTruthy();
    expect(screen.queryByText(/Complete an estimate or export on a project/i)).toBeNull();
    // Checked snapshot item present; no Estimate/Export completion claim
    const items = screen.getAllByText(/Optional: create a feasibility snapshot/i);
    expect(items.length).toBeGreaterThan(0);
  });

  it("PH-TRUTH-R1: when Study not celebrated, optional snapshot remains unchecked wording only", () => {
    hasCompletedFirstStudy.mockReturnValue(false);
    renderDashboard();
    expect(screen.getByText(/Optional: create a feasibility snapshot/i)).toBeTruthy();
    expect(screen.queryByText(/Complete an estimate or export on a project/i)).toBeNull();
  });

  it("hides new-user welcome card when consume flag is false", () => {
    consumeNewUserOnboarding.mockReturnValue(false);
    renderDashboard();
    expect(screen.queryByText(/Welcome, Ada/)).toBeNull();
  });

  it("uses useAuth for welcome display and AppLayout head metadata", () => {
    renderDashboard();
    expect(useAuth).toHaveBeenCalled();
    const layout = screen.getByTestId("app-layout");
    expect(layout.getAttribute("data-title")).toBe("Dashboard");
  });

  it("route source has no platform Supabase or auth.updateUser", () => {
    const src = readFileSync(ROUTE_SRC, "utf8");
    expect(src).toMatch(/useOnboardingGoalSelection\s*\(/);
    expect(src).not.toMatch(/@\/platform\/supabase/);
    expect(src).not.toMatch(/supabase\.auth/);
    expect(src).not.toMatch(/updateUser\s*\(/);
    expect(src).not.toMatch(/onboarding_goal\s*:/);
    expect(src).not.toMatch(/useMutation|useQueryClient/);
    expect(src).not.toMatch(/AuthExperience/);
  });

  it("route path and head title remain dashboard", () => {
    expect(Route.path ?? "/_authed/dashboard").toMatch(/dashboard/);
    const head = (Route.options as { head?: () => { meta: { title: string }[] } }).head;
    expect(head).toBeTruthy();
    const meta = head!();
    expect(meta.meta[0].title).toBe("Dashboard — Refurb Genius");
  });
});
