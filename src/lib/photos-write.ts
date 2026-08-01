/**
 * Canonical browser-side project-photo write primitives (C5-3B1 / C5-3B1R).
 *
 * Centralises Storage path construction, Auth resolution for writes, upload
 * timeout/rollback, batch concurrency, and database-first delete.
 *
 * Does NOT coordinate React Query or the legacy in-memory photo cache —
 * consumers migrate in C5-3B2 / C5-3B3. Does not claim atomicity across
 * Postgres and Storage.
 *
 * Partial-success contract for uploadProjectPhotos:
 * - every file is attempted
 * - successful files remain persisted
 * - after all complete, throws PhotoUploadBatchError if any failed
 * - successes and failures are programmatically inspectable on the error
 *
 * Timeout note: repository `timeoutPromise` races without cancelling the
 * underlying Supabase request. Late Storage completion after a timeout may
 * leave an orphan object; late metadata completion may race rollback.
 * Cleanup is best-effort; no transactional guarantee is claimed.
 */
import { isImageFile, imageContentType } from "@/lib/file-utils";
import { supabase } from "@/platform/supabase/browser";
import { auth, fromSupabaseUser, type AuthUser } from "@/lib/auth";
import { captureUploadError, addDiagnosticBreadcrumb } from "@/lib/sentry";
import { logger } from "@/lib/logger";
import { timeoutPromise, isTimeoutError } from "@/lib/timeout";
import { ConcurrencyLimiter } from "@/lib/concurrency";
import { rowToPhoto } from "@/lib/mappers";
import type { ProjectPhoto } from "@/lib/photos-types";

/** Sole Storage bucket for authenticated project photos. */
export const PROJECT_PHOTOS_BUCKET = "project-photos";

/** Max size per file (aligned with upload UI + typical mobile HEIC/JPEG). */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** Soft cap for a single batch to avoid browser memory pressure. */
export const MAX_PHOTOS_PER_BATCH = 30;

const UPLOAD_TIMEOUT_MS = 60_000;
const DEFAULT_UPLOAD_CONCURRENCY = 4;
const MAX_EXTENSION_LENGTH = 16;

export const PHOTO_WRITE_AUTH_ERROR = "You must be signed in to manage project photos.";

// ── Stages & progress ─────────────────────────────────────────────

export type PhotoWriteStage =
  | "validation"
  | "authentication"
  | "storage-upload"
  | "metadata-insert"
  | "storage-rollback"
  | "metadata-delete"
  | "storage-delete"
  | "batch";

export type PhotoUploadItemState =
  | "queued"
  | "validating"
  | "authenticating"
  | "uploading"
  | "saving"
  | "rolling-back"
  | "complete"
  | "failed";

export interface PhotoUploadItemEvent {
  index: number;
  file: File;
  state: PhotoUploadItemState;
  /** Present on failed when the failing stage is known. */
  stage?: PhotoWriteStage;
  photo?: ProjectPhoto;
  error?: unknown;
}

// ── Structured errors ─────────────────────────────────────────────

export class PhotoWriteError extends Error {
  readonly name = "PhotoWriteError";
  readonly stage: PhotoWriteStage;
  readonly cause: unknown;
  readonly rollbackError?: unknown;

  constructor(
    message: string,
    options: {
      stage: PhotoWriteStage;
      cause?: unknown;
      rollbackError?: unknown;
    },
  ) {
    super(message);
    this.stage = options.stage;
    this.cause = options.cause ?? undefined;
    this.rollbackError = options.rollbackError;
  }
}

export interface PhotoUploadFailure {
  index: number;
  file: File;
  stage: PhotoWriteStage;
  cause: unknown;
}

/**
 * Thrown after a multi-file upload when at least one item failed.
 * Successful uploads remain persisted and are exposed on `successes`.
 */
export class PhotoUploadBatchError extends Error {
  readonly name = "PhotoUploadBatchError";
  readonly successes: ProjectPhoto[];
  readonly failures: PhotoUploadFailure[];
  readonly attemptedCount: number;

  constructor(input: {
    successes: ProjectPhoto[];
    failures: PhotoUploadFailure[];
    attemptedCount: number;
  }) {
    const summary = input.failures
      .map((f) => `${f.file.name}[${f.stage}]: ${errorMessage(f.cause)}`)
      .join("; ");
    super(
      `Upload completed with ${input.failures.length} error(s) of ${input.attemptedCount} attempted: ${summary}`,
    );
    this.successes = input.successes;
    this.failures = input.failures;
    this.attemptedCount = input.attemptedCount;
  }
}

// ── Removal result ────────────────────────────────────────────────

export type PhotoStorageCleanupStatus = "removed" | "already-missing" | "orphan-warning";

export interface PhotoRemovalResult {
  photoId: string;
  storagePath: string;
  storageCleanup: PhotoStorageCleanupStatus;
  storageError?: unknown;
}

// ── Path helper ───────────────────────────────────────────────────

/**
 * Build the Storage object path for a project photo.
 * Extension: final filename segment, lowercased; safe fallback `jpg`.
 * Legacy note: names like `.hiddenfile` previously used extension `hiddenfile`;
 * unsafe/empty extensions (including path separators) fall back to `jpg`.
 */
export function buildProjectPhotoStoragePath(input: {
  userId: string;
  projectId: string;
  photoId: string;
  fileName: string;
}): string {
  assertSafePathSegment(input.userId, "userId");
  assertSafePathSegment(input.projectId, "projectId");
  assertSafePathSegment(input.photoId, "photoId");
  const ext = safeFileExtension(input.fileName);
  return `${input.userId}/${input.projectId}/${input.photoId}.${ext}`;
}

function safeFileExtension(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  if (i < 0) return "jpg";
  const ext = fileName.slice(i + 1).toLowerCase();
  if (!ext || ext.length > MAX_EXTENSION_LENGTH) return "jpg";
  if (ext.includes("/") || ext.includes("\\") || ext.includes("..")) return "jpg";
  if (!/^[a-z0-9]+$/.test(ext)) return "jpg";
  return ext;
}

/** Reject empty, whitespace, path separators, and traversal segments. */
export function assertSafePathSegment(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new PhotoWriteError(`${label} is required`, {
      stage: "validation",
      cause: new Error(`${label} is required`),
    });
  }
  if (value !== value.trim()) {
    throw new PhotoWriteError(`${label} must not include leading/trailing whitespace`, {
      stage: "validation",
      cause: new Error(`${label} has surrounding whitespace`),
    });
  }
  if (value.includes("/") || value.includes("\\") || value.includes("..")) {
    throw new PhotoWriteError(`${label} contains unsafe path characters`, {
      stage: "validation",
      cause: new Error(`${label} is not a safe path segment`),
    });
  }
}

// ── Auth ──────────────────────────────────────────────────────────

async function resolvePhotoWriteUser(): Promise<AuthUser> {
  const {
    data: { user: sessionUser },
    error,
  } = await supabase.auth.getUser();
  const fromSession = fromSupabaseUser(sessionUser);
  if (fromSession && !error) return fromSession;

  const cached = auth.getUser();
  if (cached) return cached;

  throw new PhotoWriteError(PHOTO_WRITE_AUTH_ERROR, {
    stage: "authentication",
    cause: new Error(PHOTO_WRITE_AUTH_ERROR),
  });
}

// ── Progress helpers ──────────────────────────────────────────────

type ProgressEmitter = (state: PhotoUploadItemState, extra?: Partial<PhotoUploadItemEvent>) => void;

function createSafeEmitter(
  onItemState: ((event: PhotoUploadItemEvent) => void) | undefined,
  base: Pick<PhotoUploadItemEvent, "index" | "file">,
): ProgressEmitter {
  return (state, extra) => {
    if (!onItemState) return;
    try {
      onItemState({ ...base, state, ...extra });
    } catch (callbackErr) {
      logger.warn("[photos-write] onItemState callback failed", {
        state,
        error: String(callbackErr),
      });
    }
  };
}

// ── Rollback ──────────────────────────────────────────────────────

async function rollbackStorageObject(path: string): Promise<unknown | undefined> {
  try {
    const { error } = await supabase.storage.from(PROJECT_PHOTOS_BUCKET).remove([path]);
    if (error) {
      logger.error("[photos-write] rollback failed", { path, error: error.message });
      captureUploadError(error, { stage: "rollback" });
      return error;
    }
    return undefined;
  } catch (rollbackErr) {
    logger.error("[photos-write] rollback failed", { path, error: String(rollbackErr) });
    captureUploadError(rollbackErr, { stage: "rollback" });
    return rollbackErr;
  }
}

// ── Single upload ─────────────────────────────────────────────────

/**
 * Upload one image to Storage + insert photos metadata.
 * UUID is shared by Storage path, row id, and returned ProjectPhoto.id.
 *
 * Timeout: see module header — timeoutPromise does not cancel the network request.
 */
export async function uploadProjectPhoto(input: {
  projectId: string;
  file: File;
  /** Optional progress; batch uses index/file identity. */
  onItemState?: (event: PhotoUploadItemEvent) => void;
  /** Batch index; defaults to 0 for single-file callers. */
  index?: number;
}): Promise<ProjectPhoto> {
  const { projectId, file } = input;
  const index = input.index ?? 0;
  const emit = createSafeEmitter(input.onItemState, { index, file });

  emit("validating");
  assertSafePathSegment(projectId, "projectId");
  if (!file) {
    throw new PhotoWriteError("File is required", {
      stage: "validation",
      cause: new Error("File is required"),
    });
  }
  if (!isImageFile(file)) {
    throw new PhotoWriteError("Not an image file. Use JPG, PNG, WEBP, or HEIC.", {
      stage: "validation",
      cause: new Error("Not an image file"),
    });
  }
  if (file.size <= 0) {
    throw new PhotoWriteError("File is empty", {
      stage: "validation",
      cause: new Error("File is empty"),
    });
  }
  if (file.size > MAX_PHOTO_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new PhotoWriteError(
      `"${file.name}" is ${mb}MB — maximum is ${MAX_PHOTO_BYTES / (1024 * 1024)}MB per photo.`,
      {
        stage: "validation",
        cause: new Error("File too large"),
      },
    );
  }

  emit("authenticating");
  const user = await resolvePhotoWriteUser();

  const id = crypto.randomUUID();
  const path = buildProjectPhotoStoragePath({
    userId: user.id,
    projectId,
    photoId: id,
    fileName: file.name,
  });
  const contentType = imageContentType(file);

  logger.info("[photos-write] upload start", {
    projectId,
    file: file.name,
    size: file.size,
    contentType,
    path,
  });

  addDiagnosticBreadcrumb("photos-write:storage:upload", {
    file: file.name,
    size: file.size,
    path,
  });

  // ── Storage upload ──────────────────────────────────────────────
  // Timeout races without cancelling the underlying request (repository pattern).
  emit("uploading");
  try {
    const uploadResult = await timeoutPromise(
      supabase.storage
        .from(PROJECT_PHOTOS_BUCKET)
        .upload(path, file, { contentType, upsert: false }),
      UPLOAD_TIMEOUT_MS,
      `Upload ${file.name} to storage`,
    );

    const { error: upErr } = uploadResult;
    if (upErr) {
      logger.error("[photos-write] storage upload failed", {
        projectId,
        file: file.name,
        size: file.size,
        stage: "storage-upload",
        error: upErr.message,
      });
      captureUploadError(upErr, {
        projectId,
        fileSizeMb: file.size / (1024 * 1024),
        stage: "storage",
      });
      throw new PhotoWriteError(upErr.message, {
        stage: "storage-upload",
        cause: upErr,
      });
    }
  } catch (err) {
    if (err instanceof PhotoWriteError) {
      emit("failed", { stage: err.stage, error: err });
      throw err;
    }
    const stage: PhotoWriteStage = "storage-upload";
    if (isTimeoutError(err)) {
      logger.error("[photos-write] storage upload failed", {
        projectId,
        file: file.name,
        size: file.size,
        stage,
        error: "Upload timeout",
      });
      captureUploadError(err, {
        projectId,
        fileSizeMb: file.size / (1024 * 1024),
        stage: "storage",
      });
    } else {
      logger.error("[photos-write] storage upload failed", {
        projectId,
        file: file.name,
        size: file.size,
        stage,
        error: String(err),
      });
      captureUploadError(err, {
        projectId,
        fileSizeMb: file.size / (1024 * 1024),
        stage: "storage",
      });
    }
    const wrapped = new PhotoWriteError(errorMessage(err), { stage, cause: err });
    emit("failed", { stage, error: wrapped });
    throw wrapped;
  }

  const { data: pub } = supabase.storage.from(PROJECT_PHOTOS_BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  addDiagnosticBreadcrumb("photos-write:metadata:insert", { file: file.name, path });

  // ── Metadata insert (Storage already succeeded) ─────────────────
  // Timeout races without cancelling the underlying request; rollback is best-effort.
  emit("saving");
  try {
    const insertResult = await timeoutPromise(
      Promise.resolve(
        supabase
          .from("photos")
          .insert({
            id,
            project_id: projectId,
            user_id: user.id,
            storage_path: path,
            url,
            name: file.name,
            size: file.size,
          })
          .select()
          .single(),
      ),
      UPLOAD_TIMEOUT_MS,
      `Insert metadata for ${file.name}`,
    );

    const { data: row, error: insErr } = insertResult;
    if (insErr || !row) {
      const errMsg = insErr?.message ?? "No data returned from insert";
      logger.error("[photos-write] metadata insert failed", {
        projectId,
        file: file.name,
        size: file.size,
        stage: "metadata-insert",
        error: errMsg,
      });
      captureUploadError(insErr ?? new Error(errMsg), {
        projectId,
        fileSizeMb: file.size / (1024 * 1024),
        stage: "metadata",
      });

      emit("rolling-back");
      const rollbackError = await rollbackStorageObject(path);
      const primary = new PhotoWriteError(errMsg, {
        stage: "metadata-insert",
        cause: insErr ?? new Error(errMsg),
        rollbackError,
      });
      emit("failed", { stage: "metadata-insert", error: primary });
      throw primary;
    }

    const photo = rowToPhoto(row);
    logger.info("[photos-write] upload success", {
      projectId,
      photoId: id,
      file: file.name,
      size: file.size,
    });
    addDiagnosticBreadcrumb("photos-write:upload:complete", { file: file.name, id });
    emit("complete", { photo });
    return photo;
  } catch (metaErr) {
    if (metaErr instanceof PhotoWriteError) {
      throw metaErr;
    }

    // Timeout or unexpected throw during insert — roll back then rethrow.
    logger.error("[photos-write] metadata insert failed", {
      projectId,
      file: file.name,
      size: file.size,
      stage: "metadata-insert",
      error: String(metaErr),
    });
    captureUploadError(metaErr, {
      projectId,
      fileSizeMb: file.size / (1024 * 1024),
      stage: "metadata",
    });
    emit("rolling-back");
    const rollbackError = await rollbackStorageObject(path);
    const primary = new PhotoWriteError(errorMessage(metaErr), {
      stage: "metadata-insert",
      cause: metaErr,
      rollbackError,
    });
    emit("failed", { stage: "metadata-insert", error: primary });
    throw primary;
  }
}

// ── Batch upload ──────────────────────────────────────────────────

/**
 * Upload many files with concurrency limit.
 *
 * Contract: continue after failures; keep successful uploads; after all finish,
 * throw PhotoUploadBatchError if any failed. Default concurrency is 4.
 * Successes and failures are ordered by original input index.
 */
export async function uploadProjectPhotos(input: {
  projectId: string;
  files: File[];
  concurrency?: number;
  onItemState?: (event: PhotoUploadItemEvent) => void;
}): Promise<ProjectPhoto[]> {
  const { projectId, files, onItemState } = input;

  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  if (files.length > MAX_PHOTOS_PER_BATCH) {
    throw new PhotoWriteError(
      `Too many files in one batch (max ${MAX_PHOTOS_PER_BATCH}). Upload in smaller sets.`,
      {
        stage: "validation",
        cause: new Error("Batch too large"),
      },
    );
  }

  assertSafePathSegment(projectId, "projectId");
  const concurrency = normaliseConcurrency(input.concurrency);
  const limiter = new ConcurrencyLimiter(concurrency);

  logger.info("[photos-write] batch start", {
    projectId,
    fileCount: files.length,
    totalBytes: files.reduce((s, f) => s + f.size, 0),
    concurrency,
  });

  addDiagnosticBreadcrumb("photos-write:batch:start", {
    projectId,
    fileCount: files.length,
    concurrency,
  });

  const successSlots: Array<ProjectPhoto | undefined> = Array.from({ length: files.length });
  const failureSlots: Array<PhotoUploadFailure | undefined> = Array.from({
    length: files.length,
  });

  const work = files.map((file, index) =>
    limiter.run(async () => {
      const emit = createSafeEmitter(onItemState, { index, file });
      emit("queued");

      try {
        const photo = await uploadProjectPhoto({
          projectId,
          file,
          index,
          onItemState,
        });
        successSlots[index] = photo;
      } catch (err) {
        const stage = err instanceof PhotoWriteError ? err.stage : "batch";
        failureSlots[index] = {
          index,
          file,
          stage,
          cause: err,
        };
        // uploadProjectPhoto already emitted "failed" for its path; if emit was
        // skipped for non-PhotoWriteError, ensure failed is visible.
        if (!(err instanceof PhotoWriteError)) {
          emit("failed", { stage, error: err });
        }
      }
    }),
  );

  await Promise.all(work);

  const successes = successSlots.filter((p): p is ProjectPhoto => p !== undefined);
  const failures = failureSlots.filter((f): f is PhotoUploadFailure => f !== undefined);

  logger.info("[photos-write] batch complete", {
    projectId,
    attempted: files.length,
    successes: successes.length,
    failures: failures.length,
    failureStages: failures.map((f) => f.stage),
  });

  if (failures.length > 0) {
    throw new PhotoUploadBatchError({
      successes,
      failures,
      attemptedCount: files.length,
    });
  }

  return successes;
}

function normaliseConcurrency(value: number | undefined): number {
  if (value === undefined) return DEFAULT_UPLOAD_CONCURRENCY;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new PhotoWriteError("concurrency must be a positive integer", {
      stage: "validation",
      cause: new Error(`Invalid concurrency: ${String(value)}`),
    });
  }
  return value;
}

// ── Remove ────────────────────────────────────────────────────────

/**
 * Remove a project photo: database row first (returning storage_path), then Storage.
 *
 * - Auth required before any remote write.
 * - Zero-row delete throws; Storage is not called.
 * - Storage path always comes from the deleted database row (never caller-supplied).
 * - Non-missing Storage failures after metadata delete yield orphan-warning (no throw).
 */
export async function removeProjectPhoto(input: { photoId: string }): Promise<PhotoRemovalResult> {
  assertSafePathSegment(input.photoId, "photoId");

  await resolvePhotoWriteUser();

  const { data: deletedRow, error: dbError } = await supabase
    .from("photos")
    .delete()
    .eq("id", input.photoId)
    .select("id, storage_path")
    .maybeSingle();

  if (dbError) {
    logger.error("[photos-write] delete metadata failed", {
      photoId: input.photoId,
      error: dbError.message,
    });
    captureUploadError(dbError, { stage: "metadata" });
    throw new PhotoWriteError(dbError.message, {
      stage: "metadata-delete",
      cause: dbError,
    });
  }

  if (!deletedRow) {
    throw new PhotoWriteError("Photo not found", {
      stage: "metadata-delete",
      cause: new Error("Photo not found"),
    });
  }

  const storagePath = deletedRow.storage_path ?? "";
  if (!storagePath) {
    logger.warn("[photos-write] deleted row missing storage_path", {
      photoId: deletedRow.id,
    });
    return {
      photoId: deletedRow.id,
      storagePath: "",
      storageCleanup: "already-missing",
    };
  }

  const { error: storageError } = await supabase.storage
    .from(PROJECT_PHOTOS_BUCKET)
    .remove([storagePath]);

  if (!storageError) {
    return {
      photoId: deletedRow.id,
      storagePath,
      storageCleanup: "removed",
    };
  }

  if (isStorageObjectMissing(storageError)) {
    return {
      photoId: deletedRow.id,
      storagePath,
      storageCleanup: "already-missing",
      storageError,
    };
  }

  logger.warn("[photos-write] orphan storage object after metadata delete", {
    photoId: deletedRow.id,
    storagePath,
    error: storageError.message,
  });
  captureUploadError(storageError, { stage: "rollback" });

  return {
    photoId: deletedRow.id,
    storagePath,
    storageCleanup: "orphan-warning",
    storageError,
  };
}

/**
 * Detect confirmed missing Storage objects.
 * Prefers statusCode/status when present; falls back to well-known not-found messages.
 */
function isStorageObjectMissing(error: {
  message?: string;
  statusCode?: string | number;
  status?: string | number;
  error?: string;
}): boolean {
  const code = String(error.statusCode ?? error.status ?? "");
  if (code === "404" || code === "400") {
    // Supabase Storage often returns 400/404 with not-found phrasing for missing objects.
    const msg = `${error.message ?? ""} ${error.error ?? ""}`.toLowerCase();
    if (
      msg.includes("not found") ||
      msg.includes("does not exist") ||
      msg.includes("no such file") ||
      msg.includes("object not found") ||
      code === "404"
    ) {
      return true;
    }
  }
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("object not found") ||
    msg.includes("not found") ||
    msg.includes("does not exist") ||
    msg.includes("no such file")
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}
