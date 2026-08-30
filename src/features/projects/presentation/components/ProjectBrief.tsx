import { ChevronRight, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { briefActionableItems, type DashboardProjectSummary } from "../dashboardProjectSummary";
import type { ProjectWorkflowStatusLabel } from "../../domain";

export type ProjectBriefProps = {
  summaries: readonly DashboardProjectSummary[];
  onHide: () => void;
};

function statusPillClass(status: ProjectWorkflowStatusLabel): string {
  if (status === "Needs attention") return "bg-sidebar text-sidebar-foreground";
  if (status === "In progress") return "bg-primary text-primary-foreground";
  if (status === "Ready") return "border border-sidebar/30 bg-transparent text-foreground";
  if (status === "Complete") return "bg-muted text-muted-foreground";
  return "border border-border bg-transparent text-muted-foreground";
}

export function ProjectBrief({ summaries, onHide }: ProjectBriefProps) {
  const items = briefActionableItems(summaries, 3);

  return (
    <section
      aria-labelledby="project-brief-heading"
      className="rounded-2xl border border-border/70 border-l-2 border-l-sidebar bg-card px-5 py-4"
      data-testid="project-brief"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="project-brief-heading"
          className="font-serif text-xl font-semibold tracking-tight text-foreground"
        >
          Project Brief
        </h2>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          onClick={onHide}
          data-testid="project-brief-hide"
        >
          Hide
          <ChevronUp className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">The next actions that need a decision.</p>
      {items.length > 0 ? (
        <ul className="mt-2" data-testid="project-brief-items">
          {items.map((item) => {
            return (
              <li
                key={item.projectId}
                className="border-b border-border/60 py-2.5 last:border-b-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
                  <span
                    className={cn(
                      "inline-flex h-6 w-fit shrink-0 items-center rounded-sm px-2 text-[11px] font-semibold whitespace-nowrap",
                      statusPillClass(item.status),
                    )}
                    data-testid={`brief-status-${item.projectId}`}
                  >
                    {item.status}
                  </span>
                  <div className="min-w-0 lg:flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                    {item.location ? (
                      <p className="truncate text-xs text-muted-foreground">{item.location}</p>
                    ) : null}
                    {item.reasonExplanation ? (
                      <p className="text-xs text-muted-foreground">{item.reasonExplanation}</p>
                    ) : null}
                  </div>
                  <a
                    href={item.workflowRoute}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
                    data-testid={`brief-cta-${item.projectId}`}
                  >
                    {item.nextActionLabel}
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
