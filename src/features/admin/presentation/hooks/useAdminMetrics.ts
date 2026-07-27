/**
 * Admin metrics presentation hooks (AO-1D1).
 * Three independent useQuery calls — no combined query, no mutation lifecycle.
 */
import { useQuery } from "@tanstack/react-query";
import {
  adminPlatformStatsQueryOptions,
  adminRecentProjectsQueryOptions,
  adminUsersQueryOptions,
} from "../adminQueryOptions";

export function useAdminPlatformStats() {
  return useQuery(adminPlatformStatsQueryOptions());
}

export function useAdminRecentProjects() {
  return useQuery(adminRecentProjectsQueryOptions());
}

export function useAdminUsers() {
  return useQuery(adminUsersQueryOptions());
}
