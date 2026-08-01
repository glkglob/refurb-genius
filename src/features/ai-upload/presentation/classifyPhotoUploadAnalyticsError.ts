/**
 * Safe analytics classification for photo-upload failures.
 * Never forwards raw error messages, filenames, URLs, or stacks.
 */
import {
  PhotoUploadBatchError,
  PhotoWriteError,
  type PhotoWriteErrorCode,
  type PhotoWriteStage,
} from "@/lib/photos-write";

export type UploadAnalyticsStage =
  | "batch_validation"
  | "file_validation"
  | "authentication"
  | "storage"
  | "metadata"
  | "unknown";

export type UploadAnalyticsReason =
  | "file_count_limit"
  | "file_too_large"
  | "unsupported_file_type"
  | "concurrency_guard"
  | "not_authenticated"
  | "storage_upload_failed"
  | "metadata_write_failed"
  | "empty_file"
  | "invalid_concurrency"
  | "unknown";

export type UploadFailureAnalytics = {
  stage: UploadAnalyticsStage;
  reason: UploadAnalyticsReason;
  /** Files whose processing began (validated structured outcomes). */
  attempted_count: number;
  /** Terminal failed items among attempts. */
  failure_count: number;
  /** Optional safe selection size when known (not a failure count). */
  selected_count?: number;
};

function stageFromWriteStage(stage: PhotoWriteStage): UploadAnalyticsStage {
  switch (stage) {
    case "validation":
      return "file_validation";
    case "authentication":
      return "authentication";
    case "storage-upload":
    case "storage-delete":
    case "storage-rollback":
      return "storage";
    case "metadata-insert":
    case "metadata-delete":
      return "metadata";
    case "batch":
      return "batch_validation";
    default:
      return "unknown";
  }
}

function reasonFromCode(code: PhotoWriteErrorCode | undefined): UploadAnalyticsReason {
  switch (code) {
    case "file_count_limit":
      return "file_count_limit";
    case "file_too_large":
      return "file_too_large";
    case "unsupported_file_type":
      return "unsupported_file_type";
    case "empty_file":
      return "empty_file";
    case "not_authenticated":
      return "not_authenticated";
    case "invalid_concurrency":
      return "invalid_concurrency";
    case "storage_upload_failed":
      return "storage_upload_failed";
    case "metadata_write_failed":
      return "metadata_write_failed";
    default:
      return "unknown";
  }
}

/**
 * Classify an upload failure for analytics.
 * @param selectedCount optional number of files in the client selection
 */
export function classifyPhotoUploadAnalyticsError(
  error: unknown,
  selectedCount?: number,
): UploadFailureAnalytics {
  if (error instanceof PhotoUploadBatchError) {
    return {
      stage:
        error.successes.length > 0
          ? "storage"
          : stageFromWriteStage(error.failures[0]?.stage ?? "batch"),
      reason:
        error.failures.length === 0
          ? "unknown"
          : reasonFromCode(
              error.failures[0]?.cause instanceof PhotoWriteError
                ? error.failures[0].cause.code
                : "unknown",
            ),
      attempted_count: error.attemptedCount,
      failure_count: error.failures.length,
      ...(typeof selectedCount === "number" ? { selected_count: selectedCount } : {}),
    };
  }

  if (error instanceof PhotoWriteError) {
    // Pre-upload / batch-level rejections: no Storage work began.
    if (
      error.code === "file_count_limit" ||
      error.code === "invalid_concurrency" ||
      error.code === "not_authenticated"
    ) {
      return {
        stage:
          error.code === "not_authenticated"
            ? "authentication"
            : error.code === "file_count_limit"
              ? "batch_validation"
              : "batch_validation",
        reason: reasonFromCode(error.code),
        attempted_count: 0,
        failure_count: 0,
        ...(typeof selectedCount === "number" ? { selected_count: selectedCount } : {}),
      };
    }

    return {
      stage: stageFromWriteStage(error.stage),
      reason: reasonFromCode(error.code),
      // Single-file path: if we have a structured write error mid-flight, count one attempt.
      attempted_count: error.stage === "validation" || error.stage === "authentication" ? 0 : 1,
      failure_count: error.stage === "validation" || error.stage === "authentication" ? 0 : 1,
      ...(typeof selectedCount === "number" ? { selected_count: selectedCount } : {}),
    };
  }

  return {
    stage: "unknown",
    reason: "unknown",
    attempted_count: 0,
    failure_count: 0,
    ...(typeof selectedCount === "number" ? { selected_count: selectedCount } : {}),
  };
}
