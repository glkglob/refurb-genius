/**
 * User-facing photo upload error copy.
 * Maps PhotoWrite stages + common Supabase/browser failures to clear messages.
 */
import {
  PhotoUploadBatchError,
  PhotoWriteError,
  type PhotoWriteStage,
} from "@/lib/photos-write";

const STAGE_HINT: Record<PhotoWriteStage, string> = {
  validation: "Check the file type and size, then try again.",
  authentication: "Sign in again, then retry the upload.",
  "storage-upload": "We could not store the image. Check your connection and try again.",
  "metadata-insert": "The image uploaded but we could not save its details. Please retry.",
  "storage-rollback":
    "Cleanup after a failed upload did not complete. Contact support if this persists.",
  "metadata-delete": "We could not remove the photo record.",
  "storage-delete": "We could not remove the stored image file.",
  batch: "One or more photos failed. Successful ones were kept.",
};

function messageFromUnknown(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return String(error ?? "Unknown error");
}

function classifyRawMessage(raw: string): string | null {
  const lower = raw.toLowerCase();

  if (
    lower.includes("not authenticated") ||
    lower.includes("jwt") ||
    lower.includes("signed in") ||
    lower.includes("session") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("row-level security") ||
    lower.includes("rls") ||
    lower.includes("permission") ||
    lower.includes("policy")
  ) {
    return "You are not authorised to upload photos. Sign in again and retry.";
  }

  if (
    lower.includes("payload too large") ||
    lower.includes("entity too large") ||
    lower.includes("maximum allowed size") ||
    lower.includes("file too large") ||
    (lower.includes("over ") && lower.includes("mb")) ||
    lower.includes("maximum is")
  ) {
    return "That photo is too large. Use images up to 10MB each.";
  }

  if (
    lower.includes("not an image") ||
    lower.includes("unsupported") ||
    lower.includes("mime") ||
    lower.includes("content type") ||
    lower.includes("invalid file")
  ) {
    return "Unsupported file type. Use JPG, PNG, WEBP, or HEIC.";
  }

  if (lower.includes("heic") || lower.includes("heif")) {
    return "This HEIC photo could not be processed. Convert to JPG on your phone and retry.";
  }

  if (
    lower.includes("timeout") ||
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("failed to fetch")
  ) {
    return "Upload timed out or lost connection. Check your network and retry.";
  }

  if (
    lower.includes("bucket") ||
    lower.includes("storage") ||
    lower.includes("object not found")
  ) {
    return "Photo storage is unavailable right now. Please try again in a moment.";
  }

  if (lower.includes("duplicate") || lower.includes("unique") || lower.includes("already exists")) {
    return "This photo may already be uploaded. Refresh the gallery and try again.";
  }

  return null;
}

/**
 * Produce a short, user-safe error string for a single upload failure.
 */
export function formatPhotoUploadError(error: unknown, stage?: PhotoWriteStage): string {
  if (error instanceof PhotoWriteError) {
    const classified = classifyRawMessage(error.message);
    if (classified) return classified;
    const hint = STAGE_HINT[error.stage];
    // Prefer explicit validation messages (file size / type) as-is when clear.
    if (error.stage === "validation" && error.message && error.message.length < 160) {
      return error.message;
    }
    if (error.message && error.message.length < 100 && !error.message.includes("{")) {
      return `${error.message}${hint ? ` — ${hint}` : ""}`;
    }
    return hint ?? "Upload failed. Please try again.";
  }

  const raw = messageFromUnknown(error);
  const classified = classifyRawMessage(raw);
  if (classified) return classified;
  if (stage) {
    return STAGE_HINT[stage] ?? "Upload failed. Please try again.";
  }
  if (raw.length < 100 && !raw.includes("{")) return raw;
  return "Upload failed. Please try again.";
}

/**
 * Summarise a batch failure for toast / banner UI.
 */
export function formatPhotoUploadBatchError(error: PhotoUploadBatchError): string {
  const fail = error.failures.length;
  const ok = error.successes.length;
  if (ok > 0) {
    return `${ok} uploaded, ${fail} failed. Successful photos were saved — retry the failed ones.`;
  }
  const first = error.failures[0];
  const detail = first ? formatPhotoUploadError(first.cause, first.stage) : "Upload failed.";
  return fail === 1 ? detail : `${fail} photos failed to upload. ${detail}`;
}

export function stageLabel(stage: PhotoWriteStage): string {
  switch (stage) {
    case "validation":
      return "Validation";
    case "authentication":
      return "Sign-in";
    case "storage-upload":
      return "Storage";
    case "metadata-insert":
      return "Saving details";
    case "storage-rollback":
      return "Cleanup";
    case "metadata-delete":
      return "Delete record";
    case "storage-delete":
      return "Delete file";
    case "batch":
      return "Batch";
    default:
      return "Upload";
  }
}
