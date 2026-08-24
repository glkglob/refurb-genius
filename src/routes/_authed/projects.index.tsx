/**
 * IA-7 — Canonical Projects browse surface (/projects).
 *
 * Lists durable projects for entry into /projects/$id and the five-stage workflow.
 * Does not invent workflow authority — cards use ProjectContinuationCard (IA-6).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { ProjectContinuationCard } from "@/features/projects";
import { useProjects, type ProjectWithProgress } from "@/hooks/useProjects";
import { FolderPlus, Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/_authed/projects/")({
  head: () => ({ meta: [{ title: "Projects — Refurb Genius" }] }),
  component: ProjectsIndexPage,
});

function matchesQuery(project: ProjectWithProgress, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [project.name, project.address, project.postcode, project.region]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function ProjectsIndexPage() {
  const { data: projects = [], isLoading, isError, error } = useProjects();
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => projects.filter((project) => matchesQuery(project, query)),
    [projects, query],
  );

  return (
    <AppLayout
      title="Projects"
      showDealCopilotRail
      actions={
        <Button asChild className="min-h-11">
          <Link to="/analyze">
            <FolderPlus className="h-4 w-4" aria-hidden />
            New Analysis
          </Link>
        </Button>
      }
    >
      <div className="mb-6">
        <label htmlFor="projects-index-search" className="sr-only">
          Search projects
        </label>
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="projects-index-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
            data-testid="projects-index-search"
            className="field-surface h-11 w-full rounded-xl pr-3 pl-10 text-sm text-foreground placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading projects…
        </div>
      ) : isError ? (
        <EmptyState
          icon={FolderPlus}
          title="Could not load projects"
          description={error instanceof Error ? error.message : "Please try again."}
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderPlus}
          title="No projects yet"
          description="Create a project to start the five-stage refurbishment workflow."
          action={
            <Button asChild>
              <Link to="/analyze">
                <FolderPlus className="h-4 w-4" aria-hidden />
                New Analysis
              </Link>
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderPlus}
          title="No matching projects"
          description="Try a different search."
        />
      ) : (
        <div className="flex flex-col gap-4" data-testid="projects-index-grid">
          {filtered.map((project, index) => (
            <ProjectContinuationCard
              key={project.id}
              project={project}
              layout={index === 0 ? "featured" : "row"}
            />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
