/**
 * IA-7 — Canonical Projects browse surface (/projects).
 *
 * Lists durable projects for entry into /projects/$id and the five-stage workflow.
 * Does not invent workflow authority — cards use ProjectContinuationCard (IA-6).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { ProjectContinuationCard } from "@/features/projects";
import { useProjects } from "@/hooks/useProjects";
import { FolderPlus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authed/projects/")({
  head: () => ({ meta: [{ title: "Projects — Refurb Genius" }] }),
  component: ProjectsIndexPage,
});

function ProjectsIndexPage() {
  const { data: projects = [], isLoading, isError, error } = useProjects();

  return (
    <AppLayout
      title="Projects"
      subtitle="Open a refurbishment project to continue Photos, Analysis, Redesign, Estimate, and Export."
      actions={
        <Button asChild size="sm">
          <Link to="/analyze">
            <FolderPlus className="h-4 w-4" />
            New Analysis
          </Link>
        </Button>
      }
    >
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
                <FolderPlus className="h-4 w-4" />
                New Analysis
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="projects-index-grid">
          {projects.map((project) => (
            <ProjectContinuationCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
