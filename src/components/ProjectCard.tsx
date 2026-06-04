import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { memo } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowRight, MapPin } from "lucide-react";
import type { Project } from "@/core/projects";
import { estimatedRefurbCost } from "@/core/projects";

export type ProjectCardProps = {
  project: Project;
};

function ProjectCardComponent({ project }: ProjectCardProps) {
  return (
    <Link to="/projects/$id" params={{ id: project.id }} className="group block">
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
            <span className="font-medium text-foreground">
              £{estimatedRefurbCost(project).toLocaleString()}
              <span className="ml-1 text-xs font-normal text-muted-foreground">refurb</span>
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
