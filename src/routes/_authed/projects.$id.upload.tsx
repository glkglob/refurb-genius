import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { LoadingState } from "@/components/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import {
  ProjectWorkflowShell,
  buildPhotosAnalysisWorkflowState,
  analysisShellFlagsFromCurrency,
  resolveProjectNextAction,
  withProjectWorkflowOperationRunning,
} from "@/features/projects";
import { formatFileSize } from "@/lib/file-utils";
import {
  Upload,
  ImagePlus,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useProject } from "@/hooks/useProjects";
import { useSetProjectStage } from "@/features/projects";
import {
  usePhotos,
  useUploadPhotos,
  useRemovePhoto,
  getPhotoAnalysis,
  loadPhotoAnalysis,
  isImageFile,
  formatPhotoUploadBatchError,
  formatPhotoUploadError,
  checkUploadHealth,
  type UploadHealthResult,
  PhotoUploadBatchError,
  PhotoWriteError,
  type PhotoUploadItemEvent,
  type PhotoUploadItemState,
  type PhotoWriteStage,
  type RoomAnalysis,
  MAX_PHOTOS_PER_BATCH,
  MAX_PHOTO_BYTES,
  MAX_CONCURRENT_PHOTO_UPLOADS,
  trackEvent,
} from "@/features/ai-upload";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/projects/$id/upload")({
  head: () => ({ meta: [{ title: "Upload photos — Refurb Genius" }] }),
  component: UploadPage,
});

type LocalUploadStatus = "queued" | "uploading" | "saving" | "completed" | "failed";

type LocalUploadItem = {
  uiId: string;
  file: File;
  status: LocalUploadStatus;
  progress: number;
  error?: string;
  photoId?: string;
};

const STAGE_PROGRESS: Record<PhotoUploadItemState, number> = {
  queued: 0,
  validating: 8,
  authenticating: 15,
  uploading: 45,
  saving: 75,
  "rolling-back": 70,
  complete: 100,
  failed: 0,
};

function mapState(state: PhotoUploadItemState): LocalUploadStatus {
  switch (state) {
    case "queued":
      return "queued";
    case "validating":
    case "authenticating":
    case "uploading":
    case "rolling-back":
      return "uploading";
    case "saving":
      return "saving";
    case "complete":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "uploading";
  }
}

function UploadPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchItems, setBatchItems] = useState<LocalUploadItem[]>([]);
  const [health, setHealth] = useState<UploadHealthResult | null>(null);

  const { data: project, isLoading: projectLoading, error: projectError } = useProject(id);
  const { data: photos = [] } = usePhotos(id);
  // IA-5-R3A: durable Analysis evidence for catalogue-bound currentness on Photos.
  const [roomAnalyses, setRoomAnalyses] = useState<RoomAnalysis[]>([]);
  const uploadPhotos = useUploadPhotos(id);
  const removePhoto = useRemovePhoto(id);
  const setStage = useSetProjectStage();

  useEffect(() => {
    let cancelled = false;
    void checkUploadHealth().then((result) => {
      if (!cancelled) setHealth(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh Analysis evidence when project or photo catalogue changes (photo add/remove).
  const photoCatalogueKey = useMemo(
    () =>
      [...photos]
        .map((p) => p.id)
        .filter(Boolean)
        .sort()
        .join("\u0001"),
    [photos],
  );
  useEffect(() => {
    let cancelled = false;
    const cached = getPhotoAnalysis(id);
    if (cached?.length) {
      setRoomAnalyses(cached);
    }
    void loadPhotoAnalysis(id)
      .then((rows) => {
        if (!cancelled && rows?.length) setRoomAnalyses(rows);
        if (!cancelled && !rows?.length && !cached?.length) setRoomAnalyses([]);
      })
      .catch(() => {
        if (!cancelled && !cached?.length) setRoomAnalyses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id, photoCatalogueKey]);

  const updateBatchItem = useCallback((uiId: string, patch: Partial<LocalUploadItem>) => {
    setBatchItems((prev) =>
      prev.map((item) => {
        if (item.uiId !== uiId) return item;
        const next = { ...item, ...patch };
        if (typeof patch.progress === "number") {
          next.progress = Math.max(item.progress, patch.progress);
        }
        if (patch.status === "completed") next.progress = 100;
        return next;
      }),
    );
  }, []);

  const uploading = uploadPhotos.isPending;

  // IA-3 / IA-5-R3A: Photos + Analysis currency for resolver and shell.
  // Durable analyses must participate so adding a photo stales Analysis and
  // exposes update_analysis (existence of analysis_done must not imply current).
  const photosAnalysisWorkflow = useMemo(
    () =>
      buildPhotosAnalysisWorkflowState({
        photos: photos.map((p) => ({ id: p.id })),
        photosOperationRunning: uploading,
        analyses: roomAnalyses.map((a) => ({
          photoId: a.photo_id,
          source: a.source,
        })),
      }),
    [photos, uploading, roomAnalyses],
  );
  const photosNextAction = useMemo(
    () => resolveProjectNextAction({ projectId: id, workflow: photosAnalysisWorkflow }),
    [id, photosAnalysisWorkflow],
  );
  const analysisShellFlags = useMemo(
    () => analysisShellFlagsFromCurrency(photosAnalysisWorkflow.analysis.currency),
    [photosAnalysisWorkflow.analysis.currency],
  );

  if (projectLoading) {
    return (
      <AppLayout title="Upload photos" subtitle="Loading project details…">
        <LoadingState label="Loading project…" />
      </AppLayout>
    );
  }

  if (projectError) {
    return (
      <AppLayout title="Upload photos" subtitle="Failed to load project">
        <EmptyState
          icon={AlertCircle}
          title="Failed to load project"
          description="We couldn't load this project. Please try again or contact support if the problem persists."
        />
      </AppLayout>
    );
  }

  if (!project) return <Navigate to="/dashboard" />;

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    const nonImage = files.find((f) => !isImageFile(f));
    if (nonImage) {
      setError(
        `"${nonImage.name || "Selected file"}" is not an image. Use JPG, PNG, WEBP, or HEIC.`,
      );
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_PHOTO_BYTES);
    if (tooBig) {
      setError(
        `"${tooBig.name}" is over ${MAX_PHOTO_BYTES / (1024 * 1024)}MB. Compress it or choose a smaller photo.`,
      );
      return;
    }

    setError(null);

    const locals: LocalUploadItem[] = files.map((file) => ({
      uiId: crypto.randomUUID(),
      file,
      status: "queued",
      progress: 0,
    }));
    setBatchItems((prev) => [...prev, ...locals]);

    const onItemState = (event: PhotoUploadItemEvent) => {
      const target = locals[event.index];
      if (!target) return;
      const status = mapState(event.state);
      const progress =
        event.state === "failed"
          ? target.progress
          : event.state === "complete"
            ? 100
            : Math.max(target.progress, STAGE_PROGRESS[event.state] ?? target.progress);
      const patch: Partial<LocalUploadItem> = { status, progress };
      if (event.state === "complete" && event.photo) {
        patch.photoId = event.photo.id;
        patch.status = "completed";
        patch.progress = 100;
      }
      if (event.state === "failed") {
        patch.status = "failed";
        patch.error = formatPhotoUploadError(event.error, event.stage);
      }
      updateBatchItem(target.uiId, patch);
    };

    try {
      // IA-6-R1: publish cross-route photos running signal for view_stage_progress.
      await withProjectWorkflowOperationRunning(id, "photos", () =>
        uploadPhotos.mutateAsync({
          files,
          onItemState,
          concurrency: MAX_CONCURRENT_PHOTO_UPLOADS,
        }),
      );
      toast.success(files.length === 1 ? "Photo uploaded." : `${files.length} photos uploaded.`);
      setBatchItems((prev) =>
        prev.map((item) =>
          locals.some((l) => l.uiId === item.uiId)
            ? { ...item, status: "completed" as const, progress: 100 }
            : item,
        ),
      );
    } catch (err) {
      if (err instanceof PhotoUploadBatchError) {
        const message = formatPhotoUploadBatchError(err);
        setError(message);
        toast.error(message);
        for (const failure of err.failures) {
          const target = locals[failure.index];
          if (!target) continue;
          updateBatchItem(target.uiId, {
            status: "failed",
            error: formatPhotoUploadError(failure.cause, failure.stage),
          });
        }
      } else {
        const message = formatPhotoUploadError(err);
        setError(message);
        toast.error(message);
        for (const local of locals) {
          updateBatchItem(local.uiId, { status: "failed", error: message });
        }
      }
    } finally {
      if (libraryInputRef.current) libraryInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleLibraryChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFiles(event.target.files);
  };

  const handleCameraChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFiles(event.target.files);
  };

  const handlePrimaryContinuation = () => {
    if (
      photosNextAction.actionKind === "analyse_photos" ||
      photosNextAction.actionKind === "update_analysis"
    ) {
      trackEvent("ai_analysis_started", { projectId: id, photo_count: photos.length });
    }
    setStage.mutate({ id, stage: "photos", value: true });
    // Follow resolver route (analysis for analyse/update; redesign when Analysis current).
    const route = photosNextAction.route;
    if (route.includes("/redesign")) {
      void navigate({ to: "/projects/$id/redesign", params: { id } });
      return;
    }
    void navigate({ to: "/projects/$id/analysis", params: { id }, search: { focus: undefined } });
  };

  const retryFailed = () => {
    const failedFiles = batchItems.filter((i) => i.status === "failed").map((i) => i.file);
    if (failedFiles.length === 0) return;
    setBatchItems((prev) => prev.filter((i) => i.status !== "failed"));
    const dt = new DataTransfer();
    failedFiles.forEach((f) => dt.items.add(f));
    void handleFiles(dt.files);
  };

  const failedCount = batchItems.filter((i) => i.status === "failed").length;

  const continueToAnalysis =
    photosNextAction.actionKind === "analyse_photos" ||
    photosNextAction.actionKind === "update_analysis";

  return (
    <ProjectWorkflowShell
      project={project}
      route={{ surface: "upload" }}
      progress={{
        // IA-6 residual: never paint Estimate/Export Complete from legacy *_done flags.
        // Photos/Analysis come from durable catalogue currency (IA-3 / IA-5-R3A).
        photosDone: photos.length > 0,
        analysisDone: analysisShellFlags.analysisDone,
        analysisNeedsAttention: analysisShellFlags.analysisNeedsAttention,
        estimateDone: false,
        reportDone: false,
        photoCount: photos.length,
      }}
      pageTitle={project.name?.trim() || "Photos"}
      pageSubtitle="Add photos of every room. We'll run AI analysis next."
      actions={
        continueToAnalysis ? (
          <Button onClick={handlePrimaryContinuation} disabled={uploading}>
            <Sparkles className="h-4 w-4" />
            {photosNextAction.label}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : photosNextAction.actionKind === "view_stage_progress" ? (
          <Button disabled>
            <Loader2 className="h-4 w-4 animate-spin" />
            {photosNextAction.label}
          </Button>
        ) : (
          <Button disabled={uploading || photos.length === 0} onClick={handlePrimaryContinuation}>
            <Sparkles className="h-4 w-4" />
            {photosNextAction.label}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )
      }
    >
      {health && !health.ok ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Upload may not work right now</p>
            <p className="mt-0.5 text-xs opacity-90">{health.message}</p>
          </div>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-6">
          <div
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/40 p-10 text-center transition-colors hover:bg-secondary"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void handleFiles(e.dataTransfer.files);
            }}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
            <p className="mt-3 text-sm font-medium text-foreground">
              {uploading ? "Uploading…" : "Take photos or upload from your library"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPG, PNG, WEBP, or HEIC — up to {MAX_PHOTO_BYTES / (1024 * 1024)}MB each · up to 3
              concurrent
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={uploading}
                onClick={() => cameraInputRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" />
                Take Photo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => libraryInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Choose Files
              </Button>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleCameraChange}
              disabled={uploading}
            />
            <input
              ref={libraryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleLibraryChange}
              disabled={uploading}
            />
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <span>{error}</span>
                {failedCount > 0 ? (
                  <div className="mt-2">
                    <Button type="button" size="sm" variant="outline" onClick={retryFailed}>
                      <RefreshCw className="mr-1 h-3.5 w-3.5" />
                      Retry failed ({failedCount})
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {batchItems.length > 0 ? (
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Current batch</span>
                <button
                  type="button"
                  className="text-xs underline-offset-2 hover:underline"
                  onClick={() =>
                    setBatchItems((prev) =>
                      prev.filter((i) => i.status !== "completed" && i.status !== "failed"),
                    )
                  }
                >
                  Clear finished
                </button>
              </div>
              {batchItems.map((item) => (
                <div
                  key={item.uiId}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{item.file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(item.file.size)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-muted">
                      <div
                        className="h-1.5 bg-primary transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    {item.error ? (
                      <p className="mt-1 truncate text-xs text-destructive" title={item.error}>
                        {item.error}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-xs">
                    {item.status === "completed" && (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Done
                      </span>
                    )}
                    {item.status === "failed" && (
                      <span className="flex items-center gap-1 text-destructive">
                        <XCircle className="h-3.5 w-3.5" /> Failed
                      </span>
                    )}
                    {(item.status === "uploading" || item.status === "saving") && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {item.status === "saving" ? "Saving" : "Uploading"}
                      </span>
                    )}
                    {item.status === "queued" && (
                      <span className="text-muted-foreground">Queued</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-6">
            {photos.length === 0 ? (
              <EmptyState
                icon={ImagePlus}
                title="No photos yet"
                description="Upload photos of every room to get the most accurate AI analysis."
              />
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {photos.length} photo{photos.length === 1 ? "" : "s"} ready for analysis
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {photos.map((p) => (
                    <Card key={p.id} className="group relative overflow-hidden p-0">
                      <div className="relative aspect-square bg-secondary">
                        <img
                          src={p.url}
                          alt={p.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur">
                          <Sparkles className="h-3 w-3 text-accent" /> Ready for analysis
                        </span>
                        <button
                          type="button"
                          onClick={() => removePhoto.mutate(p.id)}
                          aria-label={`Remove ${p.name}`}
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 backdrop-blur transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100 focus:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="p-3">
                        <p className="truncate text-xs font-medium text-foreground">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatFileSize(p.size)}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </ProjectWorkflowShell>
  );
}
