import { workflowBoardColumns, type DashboardProjectSummary } from "../dashboardProjectSummary";
import { WorkflowBoardItem } from "./WorkflowBoardItem";

export type WorkflowBoardProps = {
  summaries: readonly DashboardProjectSummary[];
};

export function WorkflowBoard({ summaries }: WorkflowBoardProps) {
  const columns = workflowBoardColumns(summaries);

  return (
    <section aria-label="Workflow Board" data-testid="workflow-board">
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">Workflow Board</h2>
      <div className="flex min-w-0 flex-col gap-6 lg:grid lg:grid-cols-5 lg:gap-4">
        {columns.map((column) => (
          <section
            key={column.id}
            className="min-w-0"
            aria-labelledby={`workflow-stage-${column.id}`}
            data-testid={`workflow-column-${column.id}`}
            data-count={column.count}
          >
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3
                id={`workflow-stage-${column.id}`}
                className="text-sm font-semibold text-foreground"
              >
                {column.label}
              </h3>
              <p
                className="text-xs font-semibold lining-nums tabular-nums text-muted-foreground"
                data-testid={`workflow-count-${column.id}`}
              >
                {column.count}
              </p>
            </div>
            {column.projects.length > 0 ? (
              <ul className="flex min-w-0 flex-col gap-2">
                {column.projects.map((project) => (
                  <li key={project.projectId} className="min-w-0">
                    <WorkflowBoardItem summary={project} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No projects</p>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
