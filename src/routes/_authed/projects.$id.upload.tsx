import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { LoadingState } from "@/components/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { formatFileSize } from "@/core/projects";
import { Upload, ImagePlus, X, Sparkles, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { useRef, useState } from "react";
import { useProject, useSetProjectStage } from "@/hooks/useProjects";
import { usePhotos, useUploadPhotos, useRemovePhoto } from "@/features/ai-upload";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/_authed/projects/$id/upload")({
  head: () => ({ meta: [{ title: "Upload photos — Refurb Genius" }] }),
  component: UploadPage,
});

const MAX_BYTES = 10 * 1024 * 1024;

function UploadPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading, error: projectError } = useProject(id);
  const { data: photos = [] } = usePhotos(id);
  const uploadPhotos = useUploadPhotos(id);
  const removePhoto = useRemovePhoto(id);
  const setStage = useSetProjectStage();

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
    const tooBig = files.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setError(`"${tooBig.name}" is over 10MB.`);
      return;
    }
    const nonImage = files.find((f) => !f.type.startsWith("image/"));
    if (nonImage) {
      setError(`"${nonImage.name}" is not an image.`);
      return;
    }
    setError(null);
    try {
      await uploadPhotos.mutateAsync(files);
      trackEvent("photos_uploaded", { photo_count: files.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleAnalyse = () => {
    trackEvent("ai_analysis_started");
    setStage.mutate({ id, stage: "photos", value: true });
    navigate({ to: "/projects/$id/analysis", params: { id } });
  };

  const uploading = uploadPhotos.isPending;

  return (
    <AppLayout
      title="Upload photos"
      subtitle="Add photos of every room. We'll run AI analysis next."
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/projects/$id" params={{ id }} search={{ tab: "overview" }}>
              Back
            </Link>
          </Button>
          <Button onClick={handleAnalyse} disabled={photos.length === 0}>
            <Sparkles className="h-4 w-4" /> Run AI Analysis
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <Card>
        <CardContent className="p-6">
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/40 p-10 text-center transition-colors hover:bg-secondary"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
            <p className="mt-3 text-sm font-medium text-foreground">
              {uploading ? "Uploading…" : "Click or drag photos to upload"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">JPG or PNG, up to 10MB each</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
              disabled={uploading}
            />
          </label>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

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
    </AppLayout>
  );
}
