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
    <Link to="/projects/$id" params={{ id: project.id }} className="group">
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
        <div className="h-28 bg-gradient-to-br from-primary to-accent" />
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground group-hover:text-accent">
              {project.name}
            </h3>
            <StatusBadge tone="accent">{project.status}</StatusBadge>
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> {project.region}
          </p>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              £{estimatedRefurbCost(project).toLocaleString()} refurb
            </span>
            <span className="flex items-center gap-1 font-medium text-accent">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export const ProjectCard = memo(ProjectCardComponent);
