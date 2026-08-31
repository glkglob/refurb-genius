import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  briefActionableItems,
  briefStatusCounts,
  type DashboardProjectSummary,
} from "../dashboardProjectSummary";

export type ProjectBriefProps = {
  summaries: readonly DashboardProjectSummary[];
  onHide: () => void;
};

function statusPillClass(status: DashboardProjectSummary["status"]): string {
  if (status === "Needs attention") {
    return "bg-foreground text-background";
  }
  if (status === "In progress") {
    return "bg-primary text-primary-foreground";
  }
  if (status === "Ready") {
    return "border border-border bg-background text-foreground";
  }
  return "bg-muted text-muted-foreground";
}

export function ProjectBrief({ summaries, onHide }: ProjectBriefProps) {
  const counts = briefStatusCounts(summaries);
  const items = briefActionableItems(summaries, 3);

  return (
    <section
      aria-labelledby="project-brief-heading"
      className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5"
      data-testid="project-brief"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="project-brief-heading"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Project Brief
          </h2>
          <p className="mt-1 hidden break-words text-sm text-muted-foreground lg:block">
            The next actions that need a decision.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onHide}
          data-testid="project-brief-hide"
        >
          Hide
        </button>
      </div>
      <dl className="sr-only">
        <div>
          <dt>Needs attention</dt>
          <dd data-testid="brief-count-attention">{counts.needsAttention}</dd>
        </div>
        <div>
          <dt>In progress</dt>
          <dd data-testid="brief-count-progress">{counts.inProgress}</dd>
        </div>
        <div>
          <dt>Ready</dt>
          <dd data-testid="brief-count-ready">{counts.ready}</dd>
        </div>
        <div>
          <dt>Complete</dt>
          <dd data-testid="brief-count-complete">{counts.complete}</dd>
        </div>
      </dl>
      {items.length > 0 ? (
        <ul className="mt-4 flex flex-col" data-testid="project-brief-items">
          {items.map((item) => (
            <li key={item.projectId} className="border-t border-border/60">
              <a
                href={item.workflowRoute}
                data-testid={`brief-cta-${item.projectId}`}
                className="flex min-h-11 min-w-0 items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "inline-flex max-w-[11rem] shrink-0 items-center justify-center whitespace-normal rounded-full px-2.5 py-1 text-center text-xs font-medium leading-tight",
                    statusPillClass(item.status),
                  )}
                >
                  {item.status}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-4">
                  <span className="break-words font-medium text-foreground">{item.name}</span>
                  {item.location ? (
                    <span className="break-words text-sm text-muted-foreground">
                      {item.location}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="sr-only">{item.nextActionLabel}</span>
                {item.reasonExplanation ? (
                  <span className="sr-only">{item.reasonExplanation}</span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
