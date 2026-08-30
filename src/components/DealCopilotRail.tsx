/**
 * Web A — contextual Deal Copilot rail.
 *
 * Presentation only: explains the product and links into the existing
 * `/deal-copilot` surface. Does not embed chat, duplicate Copilot state,
 * or invent project-to-Copilot persistence.
 *
 * Recent projects may appear only on the Projects page. It reuses
 * owner-scoped useProjects() (first five, canonical list order) and existing
 * photo/workflow presentation authorities. No second query or recency model.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePhotos, useProjectPhotoDisplayUrl } from "@/features/ai-upload";
import { useProjectFiveStageWorkflow } from "@/features/projects";
import { useProjects, type ProjectWithProgress } from "@/hooks/useProjects";

const RECENT_LIMIT = 5;

function isProjectsIndexPath(pathname: string): boolean {
  return pathname === "/projects" || pathname === "/projects/";
}

function projectLocationLabel(project: ProjectWithProgress): string {
  return [project.address, project.postcode].filter(Boolean).join(", ") || project.region || "";
}

function railStatusClass(status: string): string {
  if (status === "Needs attention") return "text-destructive";
  if (status === "Complete" || status === "In progress" || status === "Ready") {
    return "text-primary";
  }
  return "text-muted-foreground";
}

function RecentProjectThumb({ projectId, name }: { projectId: string; name: string }) {
  const photos = usePhotos(projectId);
  const first = photos.data?.[0];
  const display = useProjectPhotoDisplayUrl({
    projectId,
    photoId: first?.id ?? "",
    storagePath: first?.storagePath ?? "",
  });
  const signedUrl = display.data?.signedUrl;

  if (first && signedUrl) {
    return (
      <img
        src={signedUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded-md object-cover"
        data-testid="recent-project-thumb"
        data-media="photo"
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted/40 text-muted-foreground/70"
      data-testid="recent-project-thumb"
      data-media="placeholder"
      aria-hidden
      title={name}
    >
      <Building2 className="h-4 w-4" />
    </div>
  );
}

function RecentProjectItem({ project }: { project: ProjectWithProgress }) {
  const fiveStage = useProjectFiveStageWorkflow(project.id);
  const status = fiveStage.loading ? "Loading" : (fiveStage.nextAction?.status ?? "Not started");
  const location = projectLocationLabel(project);

  return (
    <li className="border-b border-border/60 last:border-b-0">
      <Link
        to="/projects/$id"
        params={{ id: project.id }}
        search={{ tab: "overview" }}
        className="flex min-h-11 items-start gap-2.5 py-2.5"
        data-testid={`recent-project-${project.id}`}
      >
        <RecentProjectThumb projectId={project.id} name={project.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
          {location ? <p className="truncate text-xs text-muted-foreground">{location}</p> : null}
          <p
            className={`mt-0.5 flex items-center gap-1.5 text-xs font-medium ${railStatusClass(status)}`}
          >
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current"
              aria-hidden
            />
            {status}
          </p>
        </div>
      </Link>
    </li>
  );
}

function RecentProjectsList() {
  const { data: projects = [] } = useProjects();
  const recent = projects.slice(0, RECENT_LIMIT);
  if (recent.length === 0) return null;

  return (
    <section className="mt-6 min-h-0 flex-1 overflow-y-auto" data-testid="recent-projects">
      <h3 className="text-sm font-semibold text-foreground">Recent projects</h3>
      <ul className="mt-2">
        {recent.map((project) => (
          <RecentProjectItem key={project.id} project={project} />
        ))}
      </ul>
    </section>
  );
}

export function DealCopilotRail() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const showRecent = isProjectsIndexPath(pathname);

  return (
    <aside
      className="hidden w-64 shrink-0 max-w-full min-w-0 flex-col overflow-x-clip border-l border-border bg-card/60 p-4 xl:flex"
      aria-label="Deal Copilot"
      data-testid="deal-copilot-rail"
    >
      <h2 className="text-base font-semibold text-foreground">Deal Copilot</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Ask for guidance on a project.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Deal Copilot does not replace Photos, Analysis, Redesign, Estimate, or Export.
      </p>
      <Button asChild variant="outline" className="mt-4 min-h-11 w-full">
        <Link to="/deal-copilot" data-testid="deal-copilot-rail-open">
          Ask about a project
        </Link>
      </Button>
      {showRecent ? <RecentProjectsList /> : null}
    </aside>
  );
}
