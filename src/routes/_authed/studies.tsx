import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Archive, Copy, FileText, PlayCircle, Share2 } from "lucide-react";
import { z } from "zod";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useArchiveFeasibilityStudy,
  useDuplicateFeasibilityStudy,
  useFeasibilityStudies,
  useProjectCatalog,
  useQueueFeasibilityExport,
  useShareFeasibilityStudy,
} from "@/features/feasibility";

const searchSchema = z.object({
  projectId: z.string().optional(),
});

export const Route = createFileRoute("/_authed/studies")({
  head: () => ({ meta: [{ title: "Feasibility Studies — Refurb Genius" }] }),
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: StudiesRoute,
});

function StudiesRoute() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { data: projects = [], isLoading: loadingProjects } = useProjectCatalog();
  const [projectId, setProjectId] = useState(search.projectId ?? "");

  useEffect(() => {
    if (search.projectId) {
      setProjectId(search.projectId);
      return;
    }
    if (!projectId && projects.length > 0) {
      setProjectId(projects[0].id);
    }
  }, [projectId, projects, search.projectId]);

  const { data: snapshots = [], isLoading: loadingStudies } = useFeasibilityStudies(projectId);
  const duplicateStudy = useDuplicateFeasibilityStudy(projectId);
  const archiveStudy = useArchiveFeasibilityStudy(projectId);
  const shareStudy = useShareFeasibilityStudy(projectId);
  const queueExport = useQueueFeasibilityExport(projectId);

  const statusCounts = useMemo(() => {
    const counts = { draft: 0, complete: 0, archived: 0, shared: 0 };
    for (const snapshot of snapshots) {
      if (snapshot.study.status === "draft") counts.draft += 1;
      if (snapshot.study.status === "complete") counts.complete += 1;
      if (snapshot.study.status === "archived") counts.archived += 1;
      if (snapshot.study.status === "shared") counts.shared += 1;
    }
    return counts;
  }, [snapshots]);

  return (
    <AppLayout
      title="Study Dashboard"
      subtitle="Resume analyses, manage snapshot lifecycle, and export investor-ready reports."
      actions={
        <Button asChild size="touch">
          <Link to="/analyze" search={projectId ? { projectId } : undefined}>
            <PlayCircle className="h-4 w-4" />
            New Study
          </Link>
        </Button>
      }
    >
      <Card className="mb-6 border-border/60 bg-card/70">
        <CardHeader>
          <CardTitle className="text-base">Project filter</CardTitle>
          <CardDescription>Select a project to view feasibility snapshots.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            list="study-projects"
            value={projectId}
            onChange={(event) => {
              const nextProjectId = event.target.value;
              setProjectId(nextProjectId);
              navigate({ to: "/studies", search: { projectId: nextProjectId }, replace: true });
            }}
            placeholder={loadingProjects ? "Loading projects..." : "Select project ID"}
          />
          <datalist id="study-projects">
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name || project.address}
              </option>
            ))}
          </datalist>
          <div className="grid gap-2 sm:grid-cols-4">
            <Badge variant="secondary" className="justify-center py-1.5">
              Draft: {statusCounts.draft}
            </Badge>
            <Badge variant="secondary" className="justify-center py-1.5">
              Complete: {statusCounts.complete}
            </Badge>
            <Badge variant="secondary" className="justify-center py-1.5">
              Shared: {statusCounts.shared}
            </Badge>
            <Badge variant="secondary" className="justify-center py-1.5">
              Archived: {statusCounts.archived}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {loadingStudies ? (
        <LoadingState label="Loading studies..." />
      ) : snapshots.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No feasibility studies yet"
          description="Start a guided analysis to create immutable snapshots, ROI summaries, and investor-ready exports."
          action={
            <Button asChild size="touch">
              <Link to="/analyze" search={projectId ? { projectId } : undefined}>
                Start analysis
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {snapshots.map((snapshot) => (
            <Card key={snapshot.studyId} className="border-border/60 bg-card/70">
              <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Study v{snapshot.version}</p>
                    <Badge variant="outline">{snapshot.study.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated {snapshot.study.updatedAt.toLocaleString("en-GB")} · ROI{" "}
                    {snapshot.study.roi.baseMetrics.roi.toFixed(1)}%
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/analyze"
                      search={{ projectId: snapshot.projectId, studyId: snapshot.studyId }}
                      title="Resume this study in the guided analyze flow"
                    >
                      Resume
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Create a copy of this study snapshot"
                    onClick={() => duplicateStudy.mutate(snapshot.studyId)}
                    disabled={duplicateStudy.isPending}
                  >
                    <Copy className="h-4 w-4" />
                    Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Queue investor export generation"
                    onClick={() => queueExport.mutate(snapshot.studyId)}
                    disabled={queueExport.isPending}
                  >
                    <FileText className="h-4 w-4" />
                    Export
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Generate secure share link"
                    onClick={() => shareStudy.mutate(snapshot.studyId)}
                    disabled={shareStudy.isPending}
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Archive this study snapshot"
                    onClick={() => archiveStudy.mutate(snapshot.studyId)}
                    disabled={archiveStudy.isPending}
                  >
                    <Archive className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
