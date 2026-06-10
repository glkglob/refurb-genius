import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  PlayCircle,
  Save,
  Upload,
} from "lucide-react";
import type { Project } from "@repo/types";
import { AppLayout } from "@/components/AppLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePhotos, useUploadPhotos } from "@/features/ai-upload";
import { useExportFeasibilityReport } from "@/features/export";
import {
  useQueueFeasibilityExport,
  useProjectCatalog,
  useFeasibilityOrchestrator,
  FeasibilityStage,
} from "@/features/feasibility";
import type { FeasibilityStudy } from "@/features/feasibility";
import { toast } from "sonner";

const searchSchema = z.object({
  projectId: z.string().optional(),
  studyId: z.string().optional(),
});

const STAGE_META: ReadonlyArray<{ stage: FeasibilityStage; label: string; description: string }> = [
  { stage: FeasibilityStage.Upload, label: "Upload", description: "Property photos and intake" },
  { stage: FeasibilityStage.Analysis, label: "Analysis", description: "AI room analysis" },
  { stage: FeasibilityStage.Scope, label: "Scope", description: "Scope generation" },
  { stage: FeasibilityStage.Redesign, label: "Redesign", description: "Concept generation" },
  { stage: FeasibilityStage.Estimate, label: "Estimate", description: "Cost model" },
  { stage: FeasibilityStage.Roi, label: "ROI", description: "Investment metrics" },
  { stage: FeasibilityStage.Export, label: "Export", description: "Investor report" },
];

export const Route = createFileRoute("/_authed/analyze")({
  head: () => ({ meta: [{ title: "New Study Analysis — Refurb Genius" }] }),
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: AnalyzeRoute,
});

function AnalyzeRoute() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { data: projects = [], isLoading: loadingProjects } = useProjectCatalog();

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === search.projectId) ?? null,
    [projects, search.projectId],
  );

  const { data: photos = [] } = usePhotos(selectedProject?.id ?? "");
  const uploadPhotos = useUploadPhotos(selectedProject?.id ?? "");
  const queueExport = useQueueFeasibilityExport(selectedProject?.id ?? "");
  const exportFeasibilityReport = useExportFeasibilityReport();

  const orchestrator = useFeasibilityOrchestrator({
    project: (selectedProject as Project | null) ?? null,
    photos,
    requestedStudyId: search.studyId,
  });

  const activeStageIndex = STAGE_META.findIndex((item) => item.stage === orchestrator.stage);
  const hasCompletedStudy = orchestrator.study?.status === "complete";

  async function handleRunFullAnalysis() {
    try {
      const study = await orchestrator.runFullAnalysis();
      if (study) {
        await navigate({
          to: "/analyze",
          search: { projectId: study.projectId, studyId: study.id },
          replace: true,
        });
      }
      toast.success("Full feasibility analysis completed.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to run full analysis.";
      toast.error(message);
    }
  }

  async function handleExportReport() {
    if (!orchestrator.study) return;

    await exportFeasibilityReport.mutateAsync({
      studyId: orchestrator.study.id,
      filename: `feasibility-${orchestrator.study.id.slice(0, 8)}.pdf`,
    });
    toast.success("Feasibility report generated.");
  }

  return (
    <AppLayout
      title="Unified Feasibility Study"
      subtitle="Upload photos, run AI analysis, model ROI, and export investor-grade outputs in one flow."
      actions={
        <Button
          onClick={handleRunFullAnalysis}
          disabled={!selectedProject || photos.length === 0 || orchestrator.isRunning}
        >
          {orchestrator.isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running analysis...
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4" />
              Run Full Analysis
            </>
          )}
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Workflow Progress</CardTitle>
            <CardDescription>Single source of truth orchestrated by feasibility.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {STAGE_META.map((item, index) => {
              const completed = index < activeStageIndex || hasCompletedStudy;
              const active = item.stage === orchestrator.stage;
              return (
                <button
                  key={item.stage}
                  type="button"
                  onClick={() => orchestrator.setStage(item.stage)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    active
                      ? "border-accent bg-accent/10"
                      : completed
                        ? "border-success/40 bg-success/10"
                        : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.label}</span>
                    {completed ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : active ? (
                      <Clock3 className="h-4 w-4 text-accent" />
                    ) : (
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </button>
              );
            })}

            <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Save className="h-3.5 w-3.5 text-accent" />
                Autosave{" "}
                {orchestrator.autosavedAt
                  ? `• ${orchestrator.autosavedAt.toLocaleTimeString("en-GB")}`
                  : "• pending"}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Study Context</CardTitle>
              <CardDescription>
                Select a project and upload source photos before orchestration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="project-id">Project</Label>
                  <Input
                    id="project-id"
                    list="analyze-projects"
                    value={search.projectId ?? ""}
                    onChange={(event) =>
                      navigate({
                        to: "/analyze",
                        search: { projectId: event.target.value, studyId: search.studyId },
                        replace: true,
                      })
                    }
                    placeholder={loadingProjects ? "Loading projects..." : "Select project ID"}
                  />
                  <datalist id="analyze-projects">
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name || project.address}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div className="rounded-lg border border-border p-3 text-sm">
                  <p>
                    Photos: <span className="font-medium">{photos.length}</span>
                  </p>
                  <p>
                    Current stage:{" "}
                    <span className="font-medium capitalize">{orchestrator.stage}</span>
                  </p>
                  {orchestrator.study && (
                    <p>
                      Study:{" "}
                      <span className="font-medium">{orchestrator.study.id.slice(0, 8)}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="photo-upload" className="sr-only">
                  Upload photos
                </Label>
                <Input
                  id="photo-upload"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    if (files.length > 0) {
                      uploadPhotos.mutate(files);
                    }
                  }}
                  disabled={!selectedProject || uploadPhotos.isPending}
                  className="max-w-sm"
                />
                <Badge variant="secondary">
                  <Upload className="mr-1 h-3.5 w-3.5" />{" "}
                  {uploadPhotos.isPending ? "Uploading..." : "Upload source photos"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {orchestrator.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>{orchestrator.error}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={orchestrator.retryFromLastSuccessful}
                  >
                    Retry stage
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={orchestrator.continueFromCurrentStage}
                  >
                    Continue from last success
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <StagePanel
            stage={orchestrator.stage}
            study={orchestrator.study}
            redesignCount={orchestrator.redesignConcepts.length}
          />

          {orchestrator.stage === FeasibilityStage.Export && orchestrator.study && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Export & Persistence</CardTitle>
                <CardDescription>
                  Save immutable snapshots and deliver investor outputs.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => queueExport.mutate(orchestrator.study!.id)}
                  disabled={queueExport.isPending}
                >
                  Queue Investor Export
                </Button>
                <Button onClick={handleExportReport} disabled={exportFeasibilityReport.isPending}>
                  {exportFeasibilityReport.isPending
                    ? "Generating report..."
                    : "Export Feasibility PDF"}
                </Button>
                <Button asChild variant="secondary">
                  <a href={`/studies/${orchestrator.study.id}`}>Open study dashboard</a>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function StagePanel({
  stage,
  study,
  redesignCount,
}: {
  stage: FeasibilityStage;
  study: FeasibilityStudy | null;
  redesignCount: number;
}) {
  const sectionTitle =
    stage === FeasibilityStage.Upload
      ? "Upload"
      : stage === FeasibilityStage.Analysis
        ? "AI Analysis"
        : stage === FeasibilityStage.Scope
          ? "Scope Generation"
          : stage === FeasibilityStage.Redesign
            ? "Redesign Concepts"
            : stage === FeasibilityStage.Estimate
              ? "Cost Estimate"
              : stage === FeasibilityStage.Roi
                ? "ROI Analysis"
                : "Export";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{sectionTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!study ? (
          <p className="text-muted-foreground">
            Run full analysis to generate and persist a feasibility snapshot.
          </p>
        ) : (
          <>
            {(stage === FeasibilityStage.Analysis || stage === FeasibilityStage.Scope) && (
              <p>Detected rooms: {study.roomAnalyses.length}</p>
            )}
            {stage === FeasibilityStage.Scope && <p>Scope summary: {study.scope.summary}</p>}
            {stage === FeasibilityStage.Redesign && (
              <p>Generated redesign concepts: {redesignCount}</p>
            )}
            {stage === FeasibilityStage.Estimate && (
              <p>Estimated refurb mid total: £{study.estimate.mid_total.toLocaleString("en-GB")}</p>
            )}
            {stage === FeasibilityStage.Roi && (
              <p>
                ROI: {study.roi.baseMetrics.roi.toFixed(1)}% · Score:{" "}
                {study.roi.baseMetrics.investment_score.toFixed(1)}/10
              </p>
            )}
            {stage === FeasibilityStage.Export && (
              <p className="text-muted-foreground">
                Feasibility snapshot is saved and ready for investor report export.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
