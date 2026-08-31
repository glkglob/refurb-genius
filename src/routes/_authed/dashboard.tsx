import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ChevronRight, FolderPlus, Loader2, Menu } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { GLOBAL_NAV_ITEMS, isGlobalNavItemActive } from "@/features/navigation";
import {
  ProjectBrief,
  WorkflowBoard,
  useDashboardProjectSummaries,
  useProjectBriefVisibility,
  type DashboardProjectSummary,
} from "@/features/projects/presentation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Refurb Genius" }] }),
  component: Dashboard,
});

function Dashboard() {
  return <DashboardContent />;
}

function DashboardMobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          aria-label="Open navigation"
          aria-controls="dashboard-mobile-nav"
          data-testid="dashboard-mobile-nav-trigger"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        id="dashboard-mobile-nav"
        className="bg-popover text-popover-foreground"
      >
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription className="sr-only">Existing application destinations</SheetDescription>
        </SheetHeader>
        <nav aria-label="Primary" className="mt-6 flex flex-col gap-1">
          {GLOBAL_NAV_ITEMS.map((item) => {
            const active = isGlobalNavItemActive(pathname, item.id);
            return (
              <Link
                key={item.id}
                to={item.to}
                aria-current={active ? "page" : undefined}
                data-testid={`dashboard-mobile-nav-${item.id}`}
                className={cn(
                  "flex min-h-11 items-center rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function DashboardDealCopilotCard() {
  return (
    <section
      aria-labelledby="dashboard-deal-copilot-heading"
      className="hidden rounded-2xl border border-border/60 bg-card p-5 lg:flex lg:min-h-[16rem] lg:flex-col"
      data-testid="dashboard-deal-copilot"
    >
      <h2
        id="dashboard-deal-copilot-heading"
        className="text-lg font-semibold tracking-tight text-foreground"
      >
        Deal Copilot
      </h2>
      <p className="mt-1 break-words text-sm text-muted-foreground">
        Use Deal Copilot for acquisition questions.
      </p>
      <div className="mt-auto pt-6">
        <Button asChild className="min-h-11 rounded-full px-4">
          <Link to="/deal-copilot" data-testid="dashboard-deal-copilot-open">
            Open Deal Copilot
          </Link>
        </Button>
      </div>
    </section>
  );
}

function DashboardRecentProjects({ summaries }: { summaries: readonly DashboardProjectSummary[] }) {
  const recent = [...summaries].sort((a, b) => (a.listOrder ?? 0) - (b.listOrder ?? 0)).slice(0, 5);

  return (
    <section
      aria-labelledby="dashboard-recent-projects-heading"
      className="hidden rounded-2xl border border-border/60 bg-card p-5 lg:block"
      data-testid="dashboard-recent-projects"
    >
      <h2
        id="dashboard-recent-projects-heading"
        className="text-lg font-semibold tracking-tight text-foreground"
      >
        Recent projects
      </h2>
      {recent.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No projects yet.</p>
      ) : (
        <ul className="mt-3">
          {recent.map((project) => (
            <li key={project.projectId} className="border-t border-border/60 first:border-t-0">
              <a
                href={project.overviewRoute || `/projects/${project.projectId}`}
                className="flex min-h-11 min-w-0 items-center gap-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid={`dashboard-recent-project-${project.projectId}`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                <span className="min-w-0 flex-1 break-words font-medium text-foreground">
                  {project.name}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DashboardContent() {
  const { data: projects = [], isLoading, isPending, isError, error, refetch } = useProjects();
  const listLoading = isLoading || isPending;
  const workflowProjects = listLoading || isError ? [] : projects;
  const workflow = useDashboardProjectSummaries(workflowProjects);
  const brief = useProjectBriefVisibility();

  return (
    <AppLayout showMobileTopBar={false}>
      <div data-testid="dashboard-home">
        <header className="mb-6 lg:mb-8">
          <div className="relative flex min-h-11 items-center lg:items-start lg:justify-between">
            <div className="z-10 flex min-h-11 min-w-11 items-center lg:hidden">
              <DashboardMobileNav />
            </div>
            <div className="min-w-0 lg:flex-1">
              <h1 className="absolute inset-x-11 text-center text-xl font-semibold tracking-tight text-foreground sm:text-3xl lg:static lg:inset-auto lg:text-left">
                <span className="lg:hidden">Home</span>
                <span className="hidden lg:inline">Dashboard</span>
              </h1>
              <p className="mt-1 hidden break-words text-sm text-muted-foreground lg:block">
                See what needs attention across your refurbishment projects.
              </p>
            </div>
            <div className="z-10 ml-auto shrink-0">
              <Button asChild className="min-h-11 rounded-full px-4">
                <Link to="/analyze" data-testid="dashboard-new-analysis">
                  New Analysis
                </Link>
              </Button>
            </div>
          </div>
        </header>

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
          <div className="flex min-w-0 flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_18.5rem] lg:items-start lg:gap-6">
            <div className="flex min-w-0 flex-col gap-6">
              {brief.visible ? (
                <ProjectBrief summaries={workflow.summaries} onHide={brief.hide} />
              ) : (
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3 text-left text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={brief.restore}
                  data-testid="project-brief-restore"
                >
                  Show Project Brief
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              )}
              <WorkflowBoard summaries={workflow.summaries} />
            </div>
            <div className="hidden min-w-0 flex-col gap-6 lg:flex">
              <DashboardDealCopilotCard />
              <DashboardRecentProjects summaries={workflow.summaries} />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
