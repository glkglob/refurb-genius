import type { LucideIcon } from "lucide-react";
import { Calculator, Camera, FileOutput, PenLine, Search } from "lucide-react";
import { workflowBoardColumns, type DashboardProjectSummary } from "../dashboardProjectSummary";
import type { ProjectWorkflowStageId } from "../../domain";
import { WorkflowBoardItem } from "./WorkflowBoardItem";

export type WorkflowBoardProps = {
  summaries: readonly DashboardProjectSummary[];
};

const STAGE_ICONS: Record<ProjectWorkflowStageId, LucideIcon> = {
  photos: Camera,
  analysis: Search,
  redesign: PenLine,
  estimate: Calculator,
  export: FileOutput,
};

const VISIBLE_PER_STAGE = 3;

export function WorkflowBoard({ summaries }: WorkflowBoardProps) {
  const columns = workflowBoardColumns(summaries);

  return (
    <section aria-label="Workflow Board" data-testid="workflow-board">
      <h2 className="mb-4 font-serif text-xl font-semibold tracking-tight text-foreground">
        Workflow Board
      </h2>
      <div className="flex min-w-0 flex-col gap-4 lg:grid lg:grid-cols-5 lg:gap-3">
        {columns.map((column) => {
          const Icon = STAGE_ICONS[column.id];
          const visible = column.projects.slice(0, VISIBLE_PER_STAGE);
          const hasOverflow = column.projects.length > VISIBLE_PER_STAGE;
          return (
            <section
              key={column.id}
              className="min-w-0 rounded-2xl border border-border/70 bg-card p-3"
              aria-labelledby={`workflow-stage-${column.id}`}
              data-testid={`workflow-column-${column.id}`}
              data-count={column.count}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3
                  id={`workflow-stage-${column.id}`}
                  className="flex min-w-0 items-center gap-1.5 text-sm font-semibold leading-snug text-foreground"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="whitespace-nowrap">{column.label}</span>
                </h3>
                <p
                  className="shrink-0 text-xs font-medium text-muted-foreground"
                  data-testid={`workflow-count-${column.id}`}
                >
                  {column.count}
                </p>
              </div>
              {visible.length > 0 ? (
                <ul className="flex min-w-0 flex-col gap-2">
                  {visible.map((project) => (
                    <li key={project.projectId} className="min-w-0">
                      <WorkflowBoardItem summary={project} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No projects</p>
              )}
              {hasOverflow ? (
                <a
                  href="/projects"
                  className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
                  data-testid={`workflow-view-all-${column.id}`}
                >
                  View all projects
                </a>
              ) : null}
            </section>
          );
        })}
      </div>
    </section>
  );
}
