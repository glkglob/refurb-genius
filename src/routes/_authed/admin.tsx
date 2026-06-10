import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { RequireAdmin } from "@/components/RequireAdmin";
import { MetricCard } from "@/components/MetricCard";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { AIMetricsDashboard } from "@/components/AIMetricsDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { Activity, BarChart3, Users, Folder } from "lucide-react";
import { supabase } from "@/platform/supabase/browser";
import { logger } from "@/lib/logger";

export const Route = createFileRoute("/_authed/admin")({
  head: () => ({
    meta: [{ title: "Admin — Refurb Genius" }],
  }),
  component: AdminPage,
});

interface PlatformStats {
  totalProjects: number;
  totalUsers: number;
  recentActivityCount: number;
}

interface RecentProject {
  id: string;
  name: string;
  address: string;
  status: string;
  created_at: string;
}

interface User {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
}

type StatsState =
  | { status: "loading" }
  | { status: "ready"; stats: PlatformStats }
  | { status: "error"; message: string };

type ProjectsState =
  | { status: "loading" }
  | { status: "ready"; projects: RecentProject[] }
  | { status: "error"; message: string };

type UsersState =
  | { status: "loading" }
  | { status: "ready"; users: User[] }
  | { status: "error"; message: string };

async function loadPlatformStats(): Promise<PlatformStats> {
  const [projectsRes, profilesRes, projectCountRes] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("projects")
      .select("id")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  return {
    totalProjects: projectsRes.count || 0,
    totalUsers: profilesRes.count || 0,
    recentActivityCount: projectCountRes.data?.length || 0,
  };
}

async function loadRecentProjects(): Promise<RecentProject[]> {
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

async function loadUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    logger.warn("[Admin] Could not load users (RLS may restrict access)", { error: error.message });
    return [];
  }

  return data || [];
}

function AdminPage() {
  const [statsState, setStatsState] = useState<StatsState>({ status: "loading" });
  const [projectsState, setProjectsState] = useState<ProjectsState>({ status: "loading" });
  const [usersState, setUsersState] = useState<UsersState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadPlatformStats()
        .then((stats) => {
          if (!cancelled) setStatsState({ status: "ready", stats });
        })
        .catch((err) => {
          if (!cancelled)
            setStatsState({
              status: "error",
              message: err instanceof Error ? err.message : "Failed to load platform stats",
            });
        }),

      loadRecentProjects()
        .then((projects) => {
          if (!cancelled) setProjectsState({ status: "ready", projects });
        })
        .catch((err) => {
          if (!cancelled)
            setProjectsState({
              status: "error",
              message: err instanceof Error ? err.message : "Failed to load recent projects",
            });
        }),

      loadUsers()
        .then((users) => {
          if (!cancelled) setUsersState({ status: "ready", users });
        })
        .catch((err) => {
          if (!cancelled)
            setUsersState({
              status: "error",
              message: err instanceof Error ? err.message : "Failed to load users",
            });
        }),
    ]);

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RequireAdmin>
      <AppLayout title="Admin" subtitle="Platform administration and monitoring">
        <div className="space-y-8">
          {/* Platform Stats */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Platform Stats</h2>
            {statsState.status === "loading" && <LoadingState label="Loading platform stats..." />}
            {statsState.status === "error" && (
              <EmptyState
                icon={BarChart3}
                title="Unable to load stats"
                description={statsState.message}
              />
            )}
            {statsState.status === "ready" && (
              <div className="grid gap-4 sm:grid-cols-3">
                <MetricCard
                  label="Total Projects"
                  value={statsState.stats.totalProjects.toString()}
                  icon={Folder}
                  tone="default"
                />
                <MetricCard
                  label="Registered Users"
                  value={statsState.stats.totalUsers.toString()}
                  icon={Users}
                  tone="default"
                />
                <MetricCard
                  label="Recent Activity (7d)"
                  value={statsState.stats.recentActivityCount.toString()}
                  icon={Activity}
                  tone="accent"
                />
              </div>
            )}
          </section>

          {/* AI Provider Metrics */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">AI Operations</h2>
            <AIMetricsDashboard />
          </section>

          {/* Recent Projects */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Recent Projects</h2>
            {projectsState.status === "loading" && (
              <LoadingState label="Loading recent projects..." />
            )}
            {projectsState.status === "error" && (
              <EmptyState
                icon={Folder}
                title="Unable to load projects"
                description={projectsState.message}
              />
            )}
            {projectsState.status === "ready" && projectsState.projects.length === 0 && (
              <EmptyState
                icon={Folder}
                title="No projects yet"
                description="Projects will appear here as they are created."
              />
            )}
            {projectsState.status === "ready" && projectsState.projects.length > 0 && (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {projectsState.projects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-start justify-between gap-4 border-b px-6 py-4 last:border-b-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground">{project.name}</p>
                          <p className="text-sm text-muted-foreground">{project.address}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                            {project.status}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(project.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </section>

          {/* User List */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Users</h2>
            {usersState.status === "loading" && <LoadingState label="Loading users..." />}
            {usersState.status === "error" && (
              <EmptyState
                icon={Users}
                title="Unable to load users"
                description={`${usersState.message} — You may not have permission to view user data.`}
              />
            )}
            {usersState.status === "ready" && usersState.users.length === 0 && (
              <EmptyState
                icon={Users}
                title="No users found"
                description="Users will appear here once they sign up."
              />
            )}
            {usersState.status === "ready" && usersState.users.length > 0 && (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {usersState.users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-start justify-between gap-4 px-6 py-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground">
                            {user.full_name || "Unnamed User"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {user.email || "No email"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="inline-flex rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                            {user.role}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      </AppLayout>
    </RequireAdmin>
  );
}
