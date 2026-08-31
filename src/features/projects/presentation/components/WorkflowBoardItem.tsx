import type { DashboardProjectSummary } from "../dashboardProjectSummary";

export type WorkflowBoardItemProps = {
  summary: DashboardProjectSummary;
};

export function WorkflowBoardItem({ summary }: WorkflowBoardItemProps) {
  return (
    <article
      className="min-w-0"
      data-testid="workflow-board-item"
      data-project-id={summary.projectId}
    >
      <a
        href={summary.workflowRoute}
        data-testid={`board-open-${summary.projectId}`}
        className="flex min-h-11 min-w-0 flex-col justify-center rounded-xl bg-muted/70 px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-background/60"
      >
        <p className="break-words font-medium text-foreground">{summary.name}</p>
        <p className="break-words text-xs text-muted-foreground">{summary.status}</p>
        {summary.location ? <p className="sr-only">{summary.location}</p> : null}
        {summary.reasonExplanation ? <p className="sr-only">{summary.reasonExplanation}</p> : null}
        <span className="sr-only">{summary.nextActionLabel}</span>
      </a>
    </article>
  );
}
