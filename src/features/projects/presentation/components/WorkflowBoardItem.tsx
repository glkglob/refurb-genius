import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DashboardProjectSummary } from "../dashboardProjectSummary";
import type { ProjectWorkflowStatusLabel } from "../../domain";
import { WorkflowStageProgress } from "./WorkflowStageProgress";

export type WorkflowBoardItemProps = {
  summary: DashboardProjectSummary;
};

function statusPillClass(status: ProjectWorkflowStatusLabel): string {
  if (status === "Needs attention") return "bg-sidebar text-sidebar-foreground";
  if (status === "In progress") return "bg-primary text-primary-foreground";
  if (status === "Ready") return "border border-sidebar/30 bg-transparent text-foreground";
  if (status === "Complete") return "bg-muted text-muted-foreground";
  return "border border-border bg-transparent text-muted-foreground";
}

export function WorkflowBoardItem({ summary }: WorkflowBoardItemProps) {
  return (
    <article
      className="min-w-0 rounded-xl border border-border/70 bg-background px-2.5 py-2.5"
      data-testid="workflow-board-item"
      data-project-id={summary.projectId}
    >
      <p className="truncate text-sm font-medium leading-snug text-foreground">{summary.name}</p>
      {summary.location ? (
        <p className="mt-0.5 truncate text-xs leading-snug text-muted-foreground">
          {summary.location}
        </p>
      ) : null}
      <span
        className={cn(
          "mt-1.5 inline-flex h-5 w-fit items-center rounded-sm px-1.5 text-[10px] font-semibold whitespace-nowrap",
          statusPillClass(summary.status),
        )}
        data-testid={`board-status-${summary.projectId}`}
      >
        {summary.status}
      </span>
      <WorkflowStageProgress className="mt-1.5" stages={summary.workflowStages} variant="dots" />
      <Button
        asChild
        size="sm"
        variant="outline"
        className="mt-2 min-h-11 w-full text-xs font-medium"
      >
        <a href={summary.workflowRoute} data-testid={`board-open-${summary.projectId}`}>
          Open
        </a>
      </Button>
    </article>
  );
}
