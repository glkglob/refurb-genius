/**
 * Admin metrics React Query options (AO-1D1).
 *
 * Mount-once parity with the former useEffect([]) loaders:
 * no retry, no focus/reconnect refetch, infinite staleTime.
 */
import { queryOptions } from "@tanstack/react-query";
import {
  fetchAdminPlatformStats,
  fetchAdminRecentProjects,
  fetchAdminUsers,
} from "../infrastructure/adminMetricsRead";
import type { AdminPlatformStats, AdminRecentProject, AdminUser } from "../domain";

export const adminKeys = {
  all: ["admin"] as const,
  platformStats: () => [...adminKeys.all, "platform-stats"] as const,
  recentProjects: () => [...adminKeys.all, "recent-projects"] as const,
  users: () => [...adminKeys.all, "users"] as const,
};

const mountOnceQueryDefaults = {
  retry: false as const,
  refetchOnWindowFocus: false as const,
  refetchOnReconnect: false as const,
  staleTime: Infinity,
};

export function adminPlatformStatsQueryOptions() {
  return queryOptions<AdminPlatformStats>({
    queryKey: adminKeys.platformStats(),
    queryFn: fetchAdminPlatformStats,
    ...mountOnceQueryDefaults,
  });
}

export function adminRecentProjectsQueryOptions() {
  return queryOptions<AdminRecentProject[]>({
    queryKey: adminKeys.recentProjects(),
    queryFn: fetchAdminRecentProjects,
    ...mountOnceQueryDefaults,
  });
}

export function adminUsersQueryOptions() {
  return queryOptions<AdminUser[]>({
    queryKey: adminKeys.users(),
    queryFn: fetchAdminUsers,
    ...mountOnceQueryDefaults,
  });
}
