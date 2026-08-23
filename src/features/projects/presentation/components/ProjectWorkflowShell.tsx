/**
 * IA-1 / IA-8 — Shared project workflow shell.
 *
 * Provides:
 * - persistent project identity from route/domain project data
 * - five-stage workflow navigation + status presentation
 * - slot for route content and existing primary actions
 * - IA-8 mobile sticky next-action (optional; resolver-driven only)
 *
 * Does NOT own: DB mutations, AI ops, invalidation, Scope/Estimate/Export
 * generation, or next-action resolution (IA-2).
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import {
  buildProjectIdentitySubtitle,
  buildProjectIdentityTitle,
  buildProjectWorkflowStages,
  type ProjectWorkflowProgressInput,
  type ProjectWorkflowRouteContext,
} from "../../domain/workflowStages";
import { ProjectStageNav } from "./ProjectStageNav";
import { MobileStickyNextAction, type MobileStickyNextActionProps } from "./MobileStickyNextAction";

export type ProjectWorkflowShellProject = {
  id: string;
  name: string;
  address?: string | null;
  postcode?: string | null;
  property_type?: string | null;
};

export type ProjectWorkflowStickyNextAction = Omit<MobileStickyNextActionProps, "className">;

type ProjectWorkflowShellProps = {
  project: ProjectWorkflowShellProject;
  route: ProjectWorkflowRouteContext;
  progress: ProjectWorkflowProgressInput;
  /** Primary / secondary actions for the current surface (header). */
  actions?: ReactNode;
  /** Optional override for page-level title (defaults to project name). */
  pageTitle?: string;
  /** Optional override for page-level subtitle under identity. */
  pageSubtitle?: string;
  /** When false, hide the five-stage nav (rare; default true). */
  showStageNav?: boolean;
  /**
   * IA-8 — optional sticky next action for mobile only.
   * Must reuse canonical resolver labels/routes or stage mutation handlers.
   * When set, header actions hide on mobile to avoid duplicate CTAs.
   */
  stickyNextAction?: ProjectWorkflowStickyNextAction | null;
  children: ReactNode;
};

export function ProjectWorkflowShell({
  project,
  route,
  progress,
  actions,
  pageTitle,
  pageSubtitle,
  showStageNav = true,
  stickyNextAction = null,
  children,
}: ProjectWorkflowShellProps) {
  const identityTitle = buildProjectIdentityTitle(project);
  const identitySubtitle = buildProjectIdentitySubtitle(project);
  const stages = buildProjectWorkflowStages({ progress, route });
  const activeStage = stages.find((s) => s.isActive);

  const title = pageTitle ?? identityTitle;
  const subtitle =
    pageSubtitle ??
    (route.surface === "overview"
      ? (identitySubtitle ?? "Project overview")
      : [identitySubtitle, activeStage ? `Stage: ${activeStage.label}` : null]
          .filter(Boolean)
          .join(" · ") || undefined);

  const shellActions = (
    <div
      className={
        stickyNextAction
          ? "hidden flex-wrap items-center gap-2 lg:flex"
          : "flex flex-wrap items-center gap-2"
      }
    >
      {route.surface !== "overview" ? (
        <Button asChild variant="outline" size="sm">
          <Link to="/projects/$id" params={{ id: project.id }} search={{ tab: "overview" }}>
            Overview
          </Link>
        </Button>
      ) : null}
      {actions}
    </div>
  );

  return (
    <AppLayout
      title={title}
      subtitle={subtitle}
      actions={shellActions}
      mobileBottomReserve={Boolean(stickyNextAction)}
      showDealCopilotRail
    >
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Project workflow
        </p>
        {route.surface === "overview" ? (
          <p className="text-xs text-muted-foreground" data-testid="overview-workflow-hint">
            Track progress and continue your refurbishment
          </p>
        ) : activeStage ? (
          <p
            className="text-xs text-muted-foreground lg:hidden"
            data-testid="mobile-active-stage-hint"
          >
            Current stage: <span className="font-medium text-foreground">{activeStage.label}</span>
            {" · "}
            {activeStage.status}
          </p>
        ) : null}
      </div>

      {showStageNav ? (
        <div className="mb-6">
          <ProjectStageNav projectId={project.id} stages={stages} />
        </div>
      ) : null}

      {/* Reserve space so sticky CTA never permanently covers stage content. */}
      <div className={stickyNextAction ? "pb-8 lg:pb-0" : undefined}>{children}</div>

      {stickyNextAction ? <MobileStickyNextAction {...stickyNextAction} /> : null}
    </AppLayout>
  );
}
