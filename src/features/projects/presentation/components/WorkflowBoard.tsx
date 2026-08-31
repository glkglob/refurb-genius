import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { workflowBoardColumns, type DashboardProjectSummary } from "../dashboardProjectSummary";
import { WorkflowBoardItem } from "./WorkflowBoardItem";

export type WorkflowBoardProps = {
  summaries: readonly DashboardProjectSummary[];
};

export function WorkflowBoard({ summaries }: WorkflowBoardProps) {
  const columns = workflowBoardColumns(summaries);
  const [openByStage, setOpenByStage] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(columns.map((column) => [column.id, column.id === "photos"])),
  );

  return (
    <section aria-label="Workflow Board" data-testid="workflow-board">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">Workflow Board</h2>
      <p className="mb-4 mt-1 hidden break-words text-sm text-muted-foreground lg:block">
        Five stages of each refurbishment.
      </p>
      <div className="mt-4 flex min-w-0 flex-col gap-3 lg:mt-0 lg:grid lg:grid-cols-5 lg:gap-4">
        {columns.map((column) => {
          const open = openByStage[column.id] ?? false;
          return (
            <Collapsible
              key={column.id}
              open={open}
              onOpenChange={(next) =>
                setOpenByStage((current) => ({ ...current, [column.id]: next }))
              }
              className="min-w-0 rounded-2xl border border-border/60 bg-card px-3 py-2 lg:p-4"
            >
              <section
                className="min-w-0"
                aria-labelledby={`workflow-stage-${column.id}`}
                data-testid={`workflow-column-${column.id}`}
                data-count={column.count}
              >
                <div className="flex items-center justify-between gap-2 lg:mb-3 lg:items-baseline">
                  <h3
                    id={`workflow-stage-${column.id}`}
                    className="text-sm font-semibold text-foreground lg:text-base"
                  >
                    {column.label}
                  </h3>
                  <p className="sr-only" data-testid={`workflow-count-${column.id}`}>
                    {column.count}
                  </p>
                  <CollapsibleTrigger
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                    aria-label={`${open ? "Collapse" : "Expand"} ${column.label}`}
                    data-testid={`workflow-stage-toggle-${column.id}`}
                  >
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
                      aria-hidden
                    />
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent
                  forceMount
                  className={open ? "block pt-2 lg:pt-0" : "hidden lg:block"}
                >
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
                </CollapsibleContent>
              </section>
            </Collapsible>
          );
        })}
      </div>
    </section>
  );
}
