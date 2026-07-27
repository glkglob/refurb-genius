/**
 * Admin metrics domain types (AO-1D1).
 * Match the previous admin route contracts exactly.
 */

export interface AdminPlatformStats {
  totalProjects: number;
  totalUsers: number;
  recentActivityCount: number;
}

export interface AdminRecentProject {
  id: string;
  name: string;
  address: string;
  status: string;
  created_at: string;
}

export interface AdminUser {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
}
