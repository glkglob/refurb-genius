/**
 * IA-1 / IA-8 — Shared five-stage project workflow navigation.
 *
 * Presentation chrome only. Does not resolve next actions (IA-2), mutate
 * workflow state, or create a first-class Redesign route (IA-4).
 *
 * IA-8 mobile: horizontally scrollable stage rail with scroll-snap, larger
 * touch targets, and text status (colour is never the sole signal).
 *
 * IA-8-VR-R2: heading stays outside the scroller; stage items alone scroll;
 * active stage is scrolled into full view on mount/route change.
 */
import { useLayoutEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Circle, AlertCircle } from "lucide-react";
import { cn } from "@repo/ui";
import type {
  ProjectWorkflowStagePresentation,
  ProjectWorkflowStatusLabel,
} from "../../domain/workflowStages";

type ProjectStageNavProps = {
  projectId: string;
  stages: ProjectWorkflowStagePresentation[];
  className?: string;
};

function statusIcon(status: ProjectWorkflowStatusLabel, isActive: boolean) {
  if (status === "Complete") {
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
        aria-hidden
      >
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "Needs attention") {
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive"
        aria-hidden
      >
        <AlertCircle className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (isActive || status === "In progress") {
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-2 ring-primary/30"
        aria-hidden
      >
        <Circle className="h-3 w-3 fill-current" />
      </span>
    );
  }
  if (status === "Ready") {
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-background text-primary"
        aria-hidden
      >
        <Circle className="h-3 w-3" />
      </span>
    );
  }
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      aria-hidden
    >
      <Circle className="h-3 w-3" />
    </span>
  );
}

function stageLinkProps(projectId: string, stage: ProjectWorkflowStagePresentation) {
  return {
    to: stage.destination.to,
    params: { id: projectId },
    search: stage.destination.to === "/projects/$id/estimate" ? { from: undefined } : undefined,
  };
}

export function ProjectStageNav({ projectId, stages, className }: ProjectStageNavProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLLIElement | null>(null);
  const activeId = stages.find((s) => s.isActive)?.id;

  // Keep the current stage fully visible in the local scroller (not the page).
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const item = activeItemRef.current;
    if (!scroller || !item) return;

    const scrollerWidth = scroller.clientWidth;
    const itemLeft = item.offsetLeft;
    const itemWidth = item.offsetWidth;
    // Centre active item when possible so label + status stay fully readable.
    const target = itemLeft - (scrollerWidth - itemWidth) / 2;
    const maxScroll = Math.max(0, scroller.scrollWidth - scrollerWidth);
    const nextLeft = Math.max(0, Math.min(target, maxScroll));
    if (typeof scroller.scrollTo === "function") {
      scroller.scrollTo({ left: nextLeft, behavior: "auto" });
    } else {
      scroller.scrollLeft = nextLeft;
    }
  }, [activeId, projectId]);

  return (
    <nav
      aria-label="Project workflow stages"
      data-testid="project-stage-nav"
      className={cn("relative rounded-xl border border-border/60 bg-card/40 p-2 sm:p-4", className)}
    >
      {/* Heading is fixed — never inside the horizontal scroller (IA-8-VR-R2). */}
      <p
        className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden"
        data-testid="project-stage-nav-heading"
      >
        Stages · swipe to see all five
      </p>

      <div
        ref={scrollerRef}
        data-testid="project-stage-nav-scroller"
        className={cn(
          // Local horizontal scroll only — must not cause whole-page overflow.
          "overflow-x-auto overscroll-x-contain scroll-smooth touch-pan-x [scrollbar-width:thin]",
          "snap-x snap-mandatory sm:snap-none",
          // Room so edge items can sit fully in view when snapped.
          "scroll-pl-1 scroll-pr-1",
        )}
      >
        <ol className={cn("flex min-w-min flex-row items-stretch gap-1.5 sm:w-full sm:gap-0")}>
          {stages.map((stage, index) => {
            const link = stageLinkProps(projectId, stage);
            return (
              <li
                key={stage.id}
                ref={stage.isActive ? activeItemRef : undefined}
                className={cn(
                  "relative flex shrink-0 sm:min-w-0 sm:flex-1",
                  // Fixed mobile width: full "3. Redesign" + status readable; snap centres active.
                  "w-[9rem] snap-center sm:w-auto sm:max-w-none",
                  index < stages.length - 1 &&
                    "after:absolute after:right-0 after:top-3.5 after:hidden after:h-px after:w-2 after:bg-border sm:after:block",
                )}
              >
                <Link
                  to={link.to}
                  params={link.params}
                  search={link.search}
                  className={cn(
                    "flex w-full min-h-12 flex-col gap-1 rounded-lg px-2.5 py-2 transition-colors",
                    "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    stage.isActive && "bg-primary/10 ring-1 ring-primary/30",
                  )}
                  aria-current={stage.isActive ? "step" : undefined}
                  aria-label={`${stage.order}. ${stage.label}, ${stage.status}`}
                  data-testid={`stage-nav-${stage.id}`}
                  data-active={stage.isActive ? "true" : "false"}
                >
                  <div className="flex items-center gap-2">
                    {statusIcon(stage.status, stage.isActive)}
                    <span
                      className={cn(
                        // Never truncate canonical stage names on mobile.
                        "whitespace-nowrap text-sm font-medium",
                        stage.isActive && "text-foreground",
                        !stage.isActive && stage.status === "Complete" && "text-foreground",
                        !stage.isActive &&
                          stage.status !== "Complete" &&
                          stage.status !== "Needs attention" &&
                          "text-muted-foreground",
                        stage.status === "Needs attention" && "text-destructive",
                      )}
                    >
                      <span className="tabular-nums text-muted-foreground">{stage.order}.</span>{" "}
                      {stage.label}
                    </span>
                  </div>
                  {/* Status as text — colour is not the sole signal */}
                  <span className="pl-9 text-xs text-muted-foreground">{stage.status}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
