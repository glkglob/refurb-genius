/**
 * AO-1D1 — admin query options and keys.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../infrastructure/adminMetricsRead", () => ({
  fetchAdminPlatformStats: vi.fn(async () => ({
    totalProjects: 1,
    totalUsers: 2,
    recentActivityCount: 3,
  })),
  fetchAdminRecentProjects: vi.fn(async () => []),
  fetchAdminUsers: vi.fn(async () => []),
}));

import {
  adminKeys,
  adminPlatformStatsQueryOptions,
  adminRecentProjectsQueryOptions,
  adminUsersQueryOptions,
} from "./adminQueryOptions";
import {
  fetchAdminPlatformStats,
  fetchAdminRecentProjects,
  fetchAdminUsers,
} from "../infrastructure/adminMetricsRead";

describe("adminKeys", () => {
  it("uses admin root, not projectKeys", () => {
    expect(adminKeys.all).toEqual(["admin"]);
    expect(adminKeys.platformStats()).toEqual(["admin", "platform-stats"]);
    expect(adminKeys.recentProjects()).toEqual(["admin", "recent-projects"]);
    expect(adminKeys.users()).toEqual(["admin", "users"]);
    expect(adminKeys.platformStats().join("")).not.toMatch(/projects/);
  });
});

describe("admin query options", () => {
  const opts = [
    adminPlatformStatsQueryOptions(),
    adminRecentProjectsQueryOptions(),
    adminUsersQueryOptions(),
  ];

  it("uses exact keys", () => {
    expect(adminPlatformStatsQueryOptions().queryKey).toEqual(["admin", "platform-stats"]);
    expect(adminRecentProjectsQueryOptions().queryKey).toEqual(["admin", "recent-projects"]);
    expect(adminUsersQueryOptions().queryKey).toEqual(["admin", "users"]);
  });

  it("binds exact query functions", async () => {
    await (adminPlatformStatsQueryOptions().queryFn as () => Promise<unknown>)();
    await (adminRecentProjectsQueryOptions().queryFn as () => Promise<unknown>)();
    await (adminUsersQueryOptions().queryFn as () => Promise<unknown>)();
    expect(fetchAdminPlatformStats).toHaveBeenCalled();
    expect(fetchAdminRecentProjects).toHaveBeenCalled();
    expect(fetchAdminUsers).toHaveBeenCalled();
  });

  it("enforces mount-once contract (no retry/focus/reconnect/poll)", () => {
    for (const o of opts) {
      expect(o.retry).toBe(false);
      expect(o.refetchOnWindowFocus).toBe(false);
      expect(o.refetchOnReconnect).toBe(false);
      expect(o.staleTime).toBe(Infinity);
      expect(o.refetchInterval).toBeUndefined();
    }
  });
});
