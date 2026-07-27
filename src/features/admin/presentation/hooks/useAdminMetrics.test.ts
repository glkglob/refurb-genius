/**
 * AO-1D1 — independent admin metrics hooks.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fetchStats = vi.fn();
const fetchProjects = vi.fn();
const fetchUsers = vi.fn();

vi.mock("../../infrastructure/adminMetricsRead", () => ({
  fetchAdminPlatformStats: (...args: unknown[]) => fetchStats(...args),
  fetchAdminRecentProjects: (...args: unknown[]) => fetchProjects(...args),
  fetchAdminUsers: (...args: unknown[]) => fetchUsers(...args),
}));

import { useAdminPlatformStats, useAdminRecentProjects, useAdminUsers } from "./useAdminMetrics";

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

function createQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

beforeEach(() => {
  fetchStats.mockReset();
  fetchProjects.mockReset();
  fetchUsers.mockReset();
  fetchStats.mockResolvedValue({ totalProjects: 1, totalUsers: 2, recentActivityCount: 0 });
  fetchProjects.mockResolvedValue([]);
  fetchUsers.mockResolvedValue([]);
});

describe("useAdminMetrics hooks", () => {
  it("loads platform stats independently", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useAdminPlatformStats(), {
      wrapper: createWrapper(qc),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      totalProjects: 1,
      totalUsers: 2,
      recentActivityCount: 0,
    });
    expect(fetchStats).toHaveBeenCalled();
    expect(fetchProjects).not.toHaveBeenCalled();
    expect(fetchUsers).not.toHaveBeenCalled();
  });

  it("loads recent projects independently", async () => {
    const qc = createQc();
    fetchProjects.mockResolvedValue([
      {
        id: "p1",
        name: "N",
        address: "A",
        status: "s",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const { result } = renderHook(() => useAdminRecentProjects(), {
      wrapper: createWrapper(qc),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(fetchProjects).toHaveBeenCalled();
    expect(fetchStats).not.toHaveBeenCalled();
  });

  it("loads users independently; soft empty is success", async () => {
    const qc = createQc();
    fetchUsers.mockResolvedValue([]);
    const { result } = renderHook(() => useAdminUsers(), {
      wrapper: createWrapper(qc),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it("surfaces thrown exceptions as isError", async () => {
    const qc = createQc();
    fetchStats.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useAdminPlatformStats(), {
      wrapper: createWrapper(qc),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(expect.objectContaining({ message: "boom" }));
  });

  it("source has no useMutation or useQueryClient", () => {
    const src = readFileSync(join(__dirname, "useAdminMetrics.ts"), "utf8");
    expect(src).toMatch(/useAdminPlatformStats/);
    expect(src).toMatch(/useAdminRecentProjects/);
    expect(src).toMatch(/useAdminUsers/);
    expect(src).not.toMatch(/useMutation|useQueryClient|useQueries/);
  });
});
