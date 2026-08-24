import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { FolderPlus, Loader2, Search } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { ProjectContinuationCard } from "@/features/projects";

export const Route = createFileRoute("/_authed/dashboard")({
  head: () => ({ meta: [{ title: "My projects — Refurb Genius" }] }),
  component: Dashboard,
});

function matchesQuery(
  project: {
    name: string;
    address?: string | null;
    postcode?: string | null;
    region?: string | null;
  },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [project.name, project.address, project.postcode, project.region]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function Dashboard() {
  return <DashboardContent />;
}

function DashboardContent() {
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => projects.filter((project) => matchesQuery(project, query)),
    [projects, query],
  );
  // First filtered list item only. Do not N-load workflow to pick an incomplete project.
  const continueProject = filtered[0] ?? null;
  const otherProjects = useMemo(() => {
    if (!continueProject) return [];
    return filtered.filter((project) => project.id !== continueProject.id);
  }, [filtered, continueProject]);

  return (
    <AppLayout showDealCopilotRail>
      <div data-testid="dashboard-projects-section">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-3xl">
            My projects
          </h1>
          <Button asChild className="min-h-11 w-full lg:w-auto">
            <Link to="/analyze" data-testid="dashboard-new-analysis">
              <FolderPlus className="h-4 w-4" aria-hidden />
              New Analysis
            </Link>
          </Button>
        </div>

        <div className="mb-6 hidden lg:block">
          <label htmlFor="dashboard-project-search" className="sr-only">
            Search projects
          </label>
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="dashboard-project-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              data-testid="dashboard-project-search"
              className="field-surface h-11 w-full rounded-xl pr-3 pl-10 text-sm text-foreground placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          </div>
        </div>

        {projectsLoading ? (
          <div
            className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading your projects…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderPlus}
            title={projects.length === 0 ? "No projects yet" : "No matching projects"}
            description={
              projects.length === 0
                ? "Create your first refurbishment project to start AI photo analysis and estimates."
                : "Try a different search."
            }
            action={
              projects.length === 0 ? (
                <Button asChild>
                  <Link to="/analyze">
                    <FolderPlus className="h-4 w-4" aria-hidden /> New Analysis
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-8">
            {continueProject ? (
              <section aria-labelledby="dashboard-continue-heading">
                <h2
                  id="dashboard-continue-heading"
                  className="mb-3 text-sm font-medium text-muted-foreground"
                >
                  Continue where you left off
                </h2>
                <div data-testid="dashboard-featured-project">
                  <ProjectContinuationCard project={continueProject} layout="featured" />
                </div>
              </section>
            ) : null}

            {otherProjects.length > 0 ? (
              <section aria-labelledby="dashboard-other-heading">
                <h2
                  id="dashboard-other-heading"
                  className="mb-3 text-sm font-medium text-muted-foreground"
                >
                  Other projects
                </h2>
                <ul className="flex flex-col gap-3" data-testid="dashboard-project-rows">
                  {otherProjects.map((project) => (
                    <li key={project.id}>
                      <ProjectContinuationCard project={project} layout="row" />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
