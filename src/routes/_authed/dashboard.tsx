import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { FolderPlus, Loader2 } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import {
  ProjectBrief,
  WorkflowBoard,
  useDashboardProjectSummaries,
  useProjectBriefVisibility,
} from "@/features/projects/presentation";

export const Route = createFileRoute("/_authed/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Refurb Genius" }] }),
  component: Dashboard,
});

function Dashboard() {
  return <DashboardContent />;
}

function DashboardContent() {
  const { data: projects = [], isLoading, isPending, isError, error, refetch } = useProjects();
  const listLoading = isLoading || isPending;
  const workflowProjects = listLoading || isError ? [] : projects;
  const workflow = useDashboardProjectSummaries(workflowProjects);
  const brief = useProjectBriefVisibility();

  return (
    <AppLayout showDealCopilotRail>
      <div data-testid="dashboard-home">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-3xl">
            <span className="lg:hidden">Home</span>
            <span className="hidden lg:inline">Dashboard</span>
          </h1>
          <Button asChild className="min-h-11 w-full lg:w-auto">
            <Link to="/analyze" data-testid="dashboard-new-analysis">
              <FolderPlus className="h-4 w-4" aria-hidden />
              New Analysis
            </Link>
          </Button>
        </div>

        {listLoading ? (
          <div
            className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading your projects…
          </div>
        ) : isError ? (
          <EmptyState
            icon={FolderPlus}
            title="Could not load projects"
            description={error instanceof Error ? error.message : "Please try again."}
            action={
              <Button type="button" className="min-h-11" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderPlus}
            title="No projects yet"
            description="Create a project to start the five-stage refurbishment workflow."
            action={
              <Button asChild>
                <Link to="/analyze">
                  <FolderPlus className="h-4 w-4" aria-hidden /> New Analysis
                </Link>
              </Button>
            }
          />
        ) : workflow.status === "loading" ? (
          <div
            className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
            data-testid="dashboard-workflow-loading"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading workflow…
          </div>
        ) : workflow.status === "error" ? (
          <EmptyState
            icon={FolderPlus}
            title="Could not load workflow"
            description={
              workflow.error instanceof Error ? workflow.error.message : "Please try again."
            }
            action={
              <Button
                type="button"
                className="min-h-11"
                onClick={() => workflow.retry()}
                data-testid="dashboard-workflow-retry"
              >
                Try again
              </Button>
            }
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-6">
            {brief.visible ? (
              <ProjectBrief summaries={workflow.summaries} onHide={brief.hide} />
            ) : (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full sm:w-auto"
                onClick={brief.restore}
                data-testid="project-brief-restore"
              >
                Show Project Brief
              </Button>
            )}
            <WorkflowBoard summaries={workflow.summaries} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
