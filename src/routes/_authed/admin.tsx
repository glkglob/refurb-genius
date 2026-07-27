import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { RequireAdmin } from "@/components/RequireAdmin";
import { MetricCard } from "@/components/MetricCard";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { AIMetricsDashboard } from "@/components/AIMetricsDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, BarChart3, Users, Folder } from "lucide-react";
import { useAdminPlatformStats, useAdminRecentProjects, useAdminUsers } from "@/features/admin";

export const Route = createFileRoute("/_authed/admin")({
  head: () => ({
    meta: [{ title: "Admin — Refurb Genius" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const statsQuery = useAdminPlatformStats();
  const projectsQuery = useAdminRecentProjects();
  const usersQuery = useAdminUsers();

  const statsState =
    statsQuery.isPending || statsQuery.isLoading
      ? ({ status: "loading" } as const)
      : statsQuery.isError
        ? ({
            status: "error",
            message:
              statsQuery.error instanceof Error
                ? statsQuery.error.message
                : "Failed to load platform stats",
          } as const)
        : ({ status: "ready", stats: statsQuery.data! } as const);

  const projectsState =
    projectsQuery.isPending || projectsQuery.isLoading
      ? ({ status: "loading" } as const)
      : projectsQuery.isError
        ? ({
            status: "error",
            message:
              projectsQuery.error instanceof Error
                ? projectsQuery.error.message
                : "Failed to load recent projects",
          } as const)
        : ({ status: "ready", projects: projectsQuery.data ?? [] } as const);

  const usersState =
    usersQuery.isPending || usersQuery.isLoading
      ? ({ status: "loading" } as const)
      : usersQuery.isError
        ? ({
            status: "error",
            message:
              usersQuery.error instanceof Error ? usersQuery.error.message : "Failed to load users",
          } as const)
        : ({ status: "ready", users: usersQuery.data ?? [] } as const);

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
