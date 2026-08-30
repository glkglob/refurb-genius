import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { ChevronDown, FolderPlus, Loader2, Plus } from "lucide-react";
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
      <div className="min-w-0 max-w-full" data-testid="dashboard-home">
        <div className="mb-6 flex flex-col gap-3 lg:mb-7 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground lg:text-[2rem] lg:leading-tight">
              <span className="lg:hidden">Home</span>
              <span className="hidden lg:inline">Dashboard</span>
            </h1>
            <p className="mt-1 hidden max-w-xl text-sm text-muted-foreground lg:block">
              See what needs attention across your refurbishment projects.
            </p>
          </div>
          <Button asChild className="min-h-11 w-full shrink-0 lg:w-auto">
            <Link to="/analyze" data-testid="dashboard-new-analysis">
              <Plus className="h-4 w-4" aria-hidden />
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
                  <Plus className="h-4 w-4" aria-hidden /> New Analysis
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
          <div className="flex min-w-0 flex-col gap-8 pb-8">
            {brief.visible ? (
              <ProjectBrief summaries={workflow.summaries} onHide={brief.hide} />
            ) : (
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border/60 bg-card px-3 text-sm text-muted-foreground hover:bg-muted/40"
                onClick={brief.restore}
                data-testid="project-brief-restore"
              >
                Show Project Brief
                <ChevronDown className="h-4 w-4" aria-hidden />
              </button>
            )}
            <WorkflowBoard summaries={workflow.summaries} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
