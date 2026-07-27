/**
 * Admin metrics read authority (AO-1D1).
 *
 * Soft PostgREST failures: stats fall back to zero; lists warn and return [].
 * Presentation-free read module (no hooks, UI, navigation, or mutations).
 */
import { supabase } from "@/platform/supabase/browser";
import { logger } from "@/lib/logger";
import type { AdminPlatformStats, AdminRecentProject, AdminUser } from "../domain";

/** Seven-day recent-activity window (evaluated at call time). */
export function adminRecentActivityThresholdIso(nowMs: number = Date.now()): string {
  return new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Platform stats: total projects count, total profiles count, 7d project creates (row length).
 * R1–R3 run concurrently. Returned PostgREST errors do not throw.
 */
export async function fetchAdminPlatformStats(): Promise<AdminPlatformStats> {
  const [projectsResult, profilesResult, recentProjectResult] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("projects").select("id").gte("created_at", adminRecentActivityThresholdIso()),
  ]);

  return {
    totalProjects: projectsResult.count || 0,
    totalUsers: profilesResult.count || 0,
    recentActivityCount: recentProjectResult.data?.length || 0,
  };
}

/**
 * Five most recent projects (admin RLS). Soft-fail to [] with warn.
 */
export async function fetchAdminRecentProjects(): Promise<AdminRecentProject[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, address, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    logger.warn("[Admin] Could not load recent projects", { error: error.message });
    return [];
  }

  return data || [];
}

/**
 * Ten most recent profiles (admin RLS). Soft-fail to [] with warn.
 */
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    logger.warn("[Admin] Could not load users (RLS may restrict access)", {
      error: error.message,
    });
    return [];
  }

  return data || [];
}
