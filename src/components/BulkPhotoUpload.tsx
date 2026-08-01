"use client";

/**
 * Bulk project-photo uploader (C5-3B3B1 / AO-1I1).
 *
 * Write authority: uploadProjectPhotos (canonical photos-write).
 * List cache invalidation: useInvalidateProjectPhotos (projectKeys.photosByProject).
 * UI item ids are React-state identity only — not Storage or database IDs.
 */
import { useState, useCallback, useRef } from "react";
import { Upload, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@repo/ui";
import { toast } from "sonner";
import {
  uploadProjectPhotos,
  PhotoUploadBatchError,
  type PhotoUploadItemEvent,
  type PhotoUploadItemState,
  type PhotoWriteStage,
} from "@/lib/photos-write";
import { formatPhotoUploadError, formatPhotoUploadBatchError } from "@/lib/upload-errors";
import { isImageFile, useInvalidateProjectPhotos } from "@/features/ai-upload";
import type { ProjectPhoto } from "@/lib/photos-types";
import { trackEvent } from "@/lib/analytics";

type UploadStatus = "queued" | "uploading" | "uploaded" | "completed" | "failed";

type UploadItem = {
  /** Local React list identity only — never used as Storage/DB authority. */
  uiId: string;
  file: File;
  status: UploadStatus;
  /** Stage-derived coarse progress (not byte transfer). */
  progress: number;
  error?: string;
  photoId?: string;
};

interface BulkPhotoUploadProps {
  projectId: string;
}

const BATCH_CONCURRENCY = 3;

/** Monotonic stage-derived progress; complete alone reaches 100. */
const STAGE_PROGRESS: Record<PhotoUploadItemState, number> = {
  queued: 0,
  validating: 5,
  authenticating: 10,
  uploading: 40,
  saving: 70,
  "rolling-back": 70,
  complete: 100,
  failed: 70,
};

function statusForState(state: PhotoUploadItemState): UploadStatus {
  switch (state) {
    case "queued":
      return "queued";
    case "validating":
    case "authenticating":
    case "uploading":
    case "rolling-back":
      return "uploading";
    case "saving":
      return "uploaded";
    case "complete":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "uploading";
  }
}

function errorTextFromUnknown(error: unknown, stage?: PhotoWriteStage): string {
  return formatPhotoUploadError(error, stage);
}

function applyStageProgress(current: number, state: PhotoUploadItemState): number {
  const next = STAGE_PROGRESS[state] ?? current;
  if (state === "complete") return 100;
  // Never regress percentage except terminal failed (keep progress).
  if (state === "failed") return Math.max(current, next);
  return Math.max(current, next);
}

export function BulkPhotoUpload({ projectId }: BulkPhotoUploadProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);
  const invalidateProjectPhotos = useInvalidateProjectPhotos(projectId);

  const updateItem = useCallback((uiId: string, updates: Partial<UploadItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.uiId !== uiId) return item;
        const next = { ...item, ...updates };
        if (typeof updates.progress === "number") {
          next.progress = Math.max(item.progress, updates.progress);
          if (updates.status === "completed") next.progress = 100;
        }
        return next;
      }),
    );
  }, []);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(isImageFile);
    if (fileArray.length === 0) {
      toast.error("Please select image files only.");
      return;
    }
    const newItems: UploadItem[] = fileArray.map((file) => ({
      uiId: crypto.randomUUID(),
      file,
      status: "queued",
      progress: 0,
    }));

    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const onItemState = useCallback(
    (batchSnapshot: UploadItem[], event: PhotoUploadItemEvent) => {
      const target = batchSnapshot[event.index];
      if (!target) return;

      const status = statusForState(event.state);
      const progress = applyStageProgress(target.progress, event.state);
      const patch: Partial<UploadItem> = { status, progress };

      if (event.state === "complete" && event.photo) {
        patch.photoId = event.photo.id;
        patch.progress = 100;
        patch.status = "completed";
      }
      if (event.state === "failed") {
        patch.status = "failed";
        patch.error = errorTextFromUnknown(event.error, event.stage);
      }

      updateItem(target.uiId, patch);
    },
    [updateItem],
  );

  const applyFullSuccess = useCallback(
    (batchSnapshot: UploadItem[], photos: ProjectPhoto[]) => {
      photos.forEach((photo, index) => {
        const target = batchSnapshot[index];
        if (!target) return;
        updateItem(target.uiId, {
          status: "completed",
          progress: 100,
          photoId: photo.id,
        });
      });
      invalidateProjectPhotos();
      toast.success("Upload complete.");
      trackEvent("photos_uploaded", {
        projectId,
        photo_count: photos.length,
      });
    },
    [invalidateProjectPhotos, updateItem, projectId],
  );

  const applyBatchError = useCallback(
    (batchSnapshot: UploadItem[], error: PhotoUploadBatchError) => {
      const failedIndexes = new Set(error.failures.map((f) => f.index));

      // Successes: ordered by original input index (complement of failures, same order as input).
      let successCursor = 0;
      for (let index = 0; index < batchSnapshot.length; index++) {
        const target = batchSnapshot[index];
        if (!target) continue;
        if (failedIndexes.has(index)) continue;
        const photo = error.successes[successCursor++];
        updateItem(target.uiId, {
          status: "completed",
          progress: 100,
          photoId: photo?.id,
        });
      }

      for (const failure of error.failures) {
        const target = batchSnapshot[failure.index];
        if (!target) continue;
        updateItem(target.uiId, {
          status: "failed",
          error: errorTextFromUnknown(failure.cause, failure.stage),
        });
      }

      if (error.successes.length > 0) {
        invalidateProjectPhotos();
        trackEvent("upload_partial_success", {
          projectId,
          success_count: error.successes.length,
          failure_count: error.failures.length,
        });
      } else {
        trackEvent("upload_failed", {
          projectId,
          failure_count: error.failures.length,
        });
      }

      toast.error(formatPhotoUploadBatchError(error));
    },
    [invalidateProjectPhotos, updateItem, projectId],
  );

  const applyTotalUnknownFailure = useCallback(
    (batchSnapshot: UploadItem[], err: unknown) => {
      const message = errorTextFromUnknown(err);
      for (const target of batchSnapshot) {
        updateItem(target.uiId, { status: "failed", error: message });
      }
      trackEvent("upload_failed", {
        projectId,
        failure_count: batchSnapshot.length,
      });
      toast.error(message);
    },
    [updateItem, projectId],
  );

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;

    // Immutable snapshot of currently queued items — event indexes map only to this batch.
    const batchSnapshot = items.filter((i) => i.status === "queued");
    if (batchSnapshot.length === 0) return;

    processingRef.current = true;
    setIsProcessing(true);

    const files = batchSnapshot.map((i) => i.file);
    trackEvent("upload_started", {
      projectId,
      file_count: files.length,
    });

    try {
      const photos = await uploadProjectPhotos({
        projectId,
        files,
        concurrency: BATCH_CONCURRENCY,
        onItemState: (event) => onItemState(batchSnapshot, event),
      });
      applyFullSuccess(batchSnapshot, photos);
    } catch (err: unknown) {
      if (err instanceof PhotoUploadBatchError) {
        applyBatchError(batchSnapshot, err);
      } else {
        applyTotalUnknownFailure(batchSnapshot, err);
      }
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [items, projectId, onItemState, applyFullSuccess, applyBatchError, applyTotalUnknownFailure]);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  const startUpload = () => {
    if (items.some((i) => i.status === "queued") && !processingRef.current) {
      void processQueue();
    }
  };

  const clearCompleted = () => {
    setItems((prev) => prev.filter((i) => i.status !== "completed" && i.status !== "failed"));
  };

  const removeItem = (uiId: string) => {
    setItems((prev) => prev.filter((i) => i.uiId !== uiId));
  };

  const retryFailed = () => {
    setItems((prev) =>
      prev.map((item) =>
        item.status === "failed"
          ? { ...item, status: "queued", progress: 0, error: undefined }
          : item,
      ),
    );
  };

  const hasQueued = items.some((i) => i.status === "queued");
  const hasActive = items.some((i) => i.status === "uploading" || i.status === "uploaded");
  const hasFailed = items.some((i) => i.status === "failed");

  return (
    <div className="space-y-4">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center hover:bg-accent/5 transition-colors"
      >
        <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Drag & drop photos here, or</p>
        <label className="mt-2 cursor-pointer text-sm text-primary underline">
          browse files
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Max {BATCH_CONCURRENCY} concurrent uploads. Progress is stage-based (not byte transfer).
        </p>
      </div>

      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">{items.length} files selected</div>
            <div className="flex gap-2">
              {hasQueued && !hasActive && (
                <Button size="sm" onClick={startUpload} disabled={isProcessing}>
                  Start Upload
                </Button>
              )}
              {hasFailed && !hasActive && (
                <Button size="sm" variant="outline" onClick={retryFailed} disabled={isProcessing}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  Retry failed
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={clearCompleted}>
                Clear completed
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.uiId} className="flex items-center gap-3 rounded border p-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{item.file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(item.file.size / 1024 / 1024).toFixed(1)}MB
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded bg-muted overflow-hidden">
                    <div
                      className="h-1.5 bg-primary transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  {item.error && (
                    <p className="mt-1 text-xs text-red-600 truncate" title={item.error}>
                      {item.error}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs uppercase tracking-widest">
                  {item.status === "queued" && "Queued"}
                  {item.status === "uploading" && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading
                    </span>
                  )}
                  {item.status === "uploaded" && (
                    <span className="flex items-center gap-1 text-blue-600">Saving</span>
                  )}
                  {item.status === "completed" && (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" /> Completed
                    </span>
                  )}
                  {item.status === "failed" && (
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle className="h-3 w-3" /> Failed
                    </span>
                  )}
                </div>

                {(item.status === "queued" || item.status === "failed") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeItem(item.uiId)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {hasActive && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing uploads (max {BATCH_CONCURRENCY} concurrent). Photos will appear in the project
          once complete.
        </div>
      )}
    </div>
  );
}
