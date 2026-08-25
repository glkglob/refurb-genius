import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  briefActionableItems,
  briefStatusCounts,
  type DashboardProjectSummary,
} from "../dashboardProjectSummary";

export type ProjectBriefProps = {
  summaries: readonly DashboardProjectSummary[];
  onHide: () => void;
};

export function ProjectBrief({ summaries, onHide }: ProjectBriefProps) {
  const counts = briefStatusCounts(summaries);
  const items = briefActionableItems(summaries, 3);

  return (
    <section
      aria-labelledby="project-brief-heading"
      className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5"
      data-testid="project-brief"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2
          id="project-brief-heading"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Project Brief
        </h2>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={onHide}
          data-testid="project-brief-hide"
        >
          Hide Project Brief
        </Button>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Needs attention
          </dt>
          <dd className="text-lg font-semibold text-foreground" data-testid="brief-count-attention">
            {counts.needsAttention}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            In progress
          </dt>
          <dd className="text-lg font-semibold text-foreground" data-testid="brief-count-progress">
            {counts.inProgress}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ready
          </dt>
          <dd className="text-lg font-semibold text-foreground" data-testid="brief-count-ready">
            {counts.ready}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Complete
          </dt>
          <dd className="text-lg font-semibold text-foreground" data-testid="brief-count-complete">
            {counts.complete}
          </dd>
        </div>
      </dl>
      {items.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3" data-testid="project-brief-items">
          {items.map((item) => (
            <li key={item.projectId}>
              <Card className="border-border/60">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{item.name}</p>
                    {item.location ? (
                      <p className="text-sm text-muted-foreground">{item.location}</p>
                    ) : null}
                    {item.reasonExplanation ? (
                      <p className="mt-1 text-sm text-muted-foreground">{item.reasonExplanation}</p>
                    ) : null}
                  </div>
                  <Button asChild className="min-h-11 w-full sm:w-auto">
                    <a href={item.workflowRoute} data-testid={`brief-cta-${item.projectId}`}>
                      {item.nextActionLabel}
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
