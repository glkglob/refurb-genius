import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { memo } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowRight, MapPin } from "lucide-react";
import type { Project } from "@/core/projects";
import { projectCardRefurbPresentation } from "@/core/projects";

export type ProjectCardProps = {
  project: Project;
};

function ProjectCardComponent({ project }: ProjectCardProps) {
  const refurb = projectCardRefurbPresentation(project);
  return (
    <Link
      to="/projects/$id"
      params={{ id: project.id }}
      search={{ tab: "overview" }}
      className="group block"
    >
      <Card className="h-full overflow-hidden border border-border/60 bg-card transition-all hover:border-accent/30 hover:shadow-lg active:scale-[0.985]">
        <div className="h-28 bg-gradient-to-br from-primary via-primary to-accent/90" />
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold tracking-tight text-foreground group-hover:text-accent">
              {project.name}
            </h3>
            <StatusBadge tone="accent">{project.status}</StatusBadge>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {project.region}
          </p>
          <div className="mt-5 flex items-center justify-between text-sm">
            {/* PUBLIC-BETA-R1: same truthfulness rule as ProjectContinuationCard */}
            <span
              className="font-medium text-muted-foreground"
              data-testid="project-card-refurb"
              data-refurb-mode={refurb.mode}
            >
              {refurb.label}
            </span>
            <span className="flex items-center gap-1 font-medium text-accent transition group-hover:gap-1.5">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export const ProjectCard = memo(ProjectCardComponent);
