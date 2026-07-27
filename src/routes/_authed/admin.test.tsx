/**
 * AO-1D1 — Admin route uses canonical metrics hooks; no direct Supabase.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const useAdminPlatformStats = vi.fn();
const useAdminRecentProjects = vi.fn();
const useAdminUsers = vi.fn();

vi.mock("@/features/admin", () => ({
  useAdminPlatformStats: (...args: unknown[]) => useAdminPlatformStats(...args),
  useAdminRecentProjects: (...args: unknown[]) => useAdminRecentProjects(...args),
  useAdminUsers: (...args: unknown[]) => useAdminUsers(...args),
}));

vi.mock("@/components/RequireAdmin", () => ({
  RequireAdmin: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "require-admin" }, children),
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

vi.mock("@/components/AIMetricsDashboard", () => ({
  AIMetricsDashboard: () => createElement("div", { "data-testid": "ai-metrics" }, "AI Metrics"),
}));

vi.mock("@/components/MetricCard", () => ({
  MetricCard: ({ label, value }: { label: string; value: string }) =>
    createElement("div", { "data-testid": `metric-${label}` }, `${label}: ${value}`),
}));

vi.mock("@/components/LoadingState", () => ({
  LoadingState: ({ label }: { label: string }) =>
    createElement("div", { "data-testid": "loading" }, label),
}));

vi.mock("@/components/EmptyState", () => ({
  EmptyState: ({ title, description }: { title: string; description?: string }) =>
    createElement(
      "div",
      { "data-testid": "empty" },
      `${title}${description ? ` — ${description}` : ""}`,
    ),
}));

// Import after mocks. Route module exports Route; render component via Route.options.
import { Route } from "./admin";

const AdminPage = Route.options.component as () => ReactNode;

function renderAdmin(qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    createElement(QueryClientProvider, { client: qc }, createElement(AdminPage as never)),
  );
}

beforeEach(() => {
  useAdminPlatformStats.mockReset();
  useAdminRecentProjects.mockReset();
  useAdminUsers.mockReset();
  useAdminPlatformStats.mockReturnValue({
    isPending: false,
    isLoading: false,
    isError: false,
    isSuccess: true,
    data: { totalProjects: 3, totalUsers: 7, recentActivityCount: 1 },
    error: null,
  });
  useAdminRecentProjects.mockReturnValue({
    isPending: false,
    isLoading: false,
    isError: false,
    isSuccess: true,
    data: [
      {
        id: "p1",
        name: "Alpha",
        address: "1 Road",
        status: "active",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    error: null,
  });
  useAdminUsers.mockReturnValue({
    isPending: false,
    isLoading: false,
    isError: false,
    isSuccess: true,
    data: [
      {
        id: "u1",
        full_name: null,
        email: null,
        role: "user",
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ],
    error: null,
  });
});

describe("AdminPage presentation", () => {
  it("calls all three admin metrics hooks", () => {
    renderAdmin();
    expect(useAdminPlatformStats).toHaveBeenCalled();
    expect(useAdminRecentProjects).toHaveBeenCalled();
    expect(useAdminUsers).toHaveBeenCalled();
  });

  it("renders metric labels and values", async () => {
    renderAdmin();
    expect(screen.getByTestId("metric-Total Projects").textContent).toContain("Total Projects: 3");
    expect(screen.getByTestId("metric-Registered Users").textContent).toContain(
      "Registered Users: 7",
    );
    expect(screen.getByTestId("metric-Recent Activity (7d)").textContent).toContain(
      "Recent Activity (7d): 1",
    );
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Unnamed User")).toBeTruthy();
    expect(screen.getByText("No email")).toBeTruthy();
    expect(screen.getByTestId("ai-metrics")).toBeTruthy();
    expect(screen.getByTestId("require-admin")).toBeTruthy();
  });

  it("shows independent loading for stats while others ready", () => {
    useAdminPlatformStats.mockReturnValue({
      isPending: true,
      isLoading: true,
      isError: false,
      data: undefined,
      error: null,
    });
    renderAdmin();
    expect(screen.getByText("Loading platform stats...")).toBeTruthy();
    expect(screen.getByText("Alpha")).toBeTruthy();
  });

  it("shows stats error EmptyState without blocking projects", () => {
    useAdminPlatformStats.mockReturnValue({
      isPending: false,
      isLoading: false,
      isError: true,
      data: undefined,
      error: new Error("stats failed"),
    });
    renderAdmin();
    expect(screen.getByText(/Unable to load stats/)).toBeTruthy();
    expect(screen.getByText("Alpha")).toBeTruthy();
  });

  it("shows empty projects state", () => {
    useAdminRecentProjects.mockReturnValue({
      isPending: false,
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: [],
      error: null,
    });
    renderAdmin();
    expect(screen.getByText(/No projects yet/)).toBeTruthy();
  });

  it("source bans platform Supabase, .from, and inline loaders", () => {
    const src = readFileSync(join(__dirname, "admin.tsx"), "utf8");
    expect(src).toMatch(/useAdminPlatformStats\s*\(/);
    expect(src).toMatch(/useAdminRecentProjects\s*\(/);
    expect(src).toMatch(/useAdminUsers\s*\(/);
    expect(src).not.toMatch(/@\/platform\/supabase/);
    expect(src).not.toMatch(/\.from\s*\(/);
    expect(src).not.toMatch(/loadPlatformStats|loadRecentProjects|loadUsers/);
    expect(src).not.toMatch(/useEffect/);
  });
});
