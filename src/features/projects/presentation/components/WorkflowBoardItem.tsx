import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardProjectSummary } from "../dashboardProjectSummary";

export type WorkflowBoardItemProps = {
  summary: DashboardProjectSummary;
};

export function WorkflowBoardItem({ summary }: WorkflowBoardItemProps) {
  return (
    <Card
      className="min-w-0 border-border/60 bg-card"
      data-testid="workflow-board-item"
      data-project-id={summary.projectId}
    >
      <CardContent className="space-y-2 p-3">
        <p className="break-words font-medium text-foreground">{summary.name}</p>
        {summary.location ? (
          <p className="truncate text-xs text-muted-foreground">{summary.location}</p>
        ) : null}
        <p className="text-xs font-medium text-foreground">{summary.status}</p>
        {summary.reasonExplanation ? (
          <p className="text-xs text-muted-foreground">{summary.reasonExplanation}</p>
        ) : null}
        <Button asChild size="sm" className="min-h-11 w-full">
          <a href={summary.workflowRoute} data-testid={`board-open-${summary.projectId}`}>
            {summary.nextActionLabel}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
