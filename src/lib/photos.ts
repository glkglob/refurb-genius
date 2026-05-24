// Supabase Storage + photos table backed photo store.
// Files live in the public `project-photos` bucket under
// `{user_id}/{project_id}/{uuid}.{ext}` so storage RLS scopes ownership by
// the leading folder. Metadata is mirrored into the `photos` table.
import { supabase } from "@/integrations/supabase/client";
import { auth } from "./auth";
import { captureUploadError, addDiagnosticBreadcrumb } from "./sentry";
import { logger } from "./logger";
import { timeoutPromise, isTimeoutError } from "./timeout";
import { ConcurrencyLimiter } from "./concurrency";
import { rowToPhoto } from "./mappers";

// Upload configuration
const UPLOAD_TIMEOUT_MS = 60_000; // 60s per file
const MAX_CONCURRENT_UPLOADS = 4; // Max 4 simultaneous uploads

export type ProjectPhoto = {
  id: string;
  projectId: string;
  url: string;
  name: string;
  size: number;
  uploadedAt: string;
  storagePath: string;
};

const BUCKET = "project-photos";

const cacheByProject = new Map<string, ProjectPhoto[]>();
const loadedProjects = new Set<string>();
const inFlight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// Concurrency limiter to prevent browser overload from simultaneous uploads
const uploadLimiter = new ConcurrencyLimiter(MAX_CONCURRENT_UPLOADS);

async function fetchProjectPhotos(projectId: string) {
  if (!auth.getUser()) {
    cacheByProject.set(projectId, []);
    loadedProjects.add(projectId);
    notify();
    return;
  }
  try {
    addDiagnosticBreadcrumb("photos:fetch:start", { projectId });
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .eq("project_id", projectId)
      .order("uploaded_at", { ascending: true });
    if (error) {
      logger.error("[photos] fetch failed", { projectId, error: error.message });
      captureUploadError(error, { projectId, stage: "metadata" });
    } else {
      addDiagnosticBreadcrumb("photos:fetch:success", { projectId, count: data?.length });
    }
    cacheByProject.set(projectId, (data ?? []).map(rowToPhoto));
  } catch (err) {
    logger.error("[photos] fetch exception", { projectId, error: String(err) });
    captureUploadError(err, { projectId, stage: "metadata" });
    cacheByProject.set(projectId, []);
  }
  loadedProjects.add(projectId);
  notify();
}

function ensureLoaded(projectId: string) {
  if (loadedProjects.has(projectId) || inFlight.has(projectId)) return;
  const p = fetchProjectPhotos(projectId).finally(() => inFlight.delete(projectId));
  inFlight.set(projectId, p);
}

if (typeof window !== "undefined") {
  auth.onChange(() => {
    cacheByProject.clear();
    loadedProjects.clear();
    notify();
  });
}

function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "jpg";
}

export const photoStore = {
  list(projectId: string): ProjectPhoto[] {
    ensureLoaded(projectId);
    return cacheByProject.get(projectId) ?? [];
  },
  async refresh(projectId: string): Promise<void> {
    await fetchProjectPhotos(projectId);
  },
  async upload(projectId: string, files: File[]): Promise<ProjectPhoto[]> {
    const user = auth.getUser();
    if (!user) throw new Error("You must be signed in to upload photos.");

    addDiagnosticBreadcrumb("photos:upload:start", {
      projectId,
      fileCount: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      timeoutPerFileMs: UPLOAD_TIMEOUT_MS,
      maxConcurrent: MAX_CONCURRENT_UPLOADS,
    });

    const created: ProjectPhoto[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    // Process all files through the concurrency limiter
    const uploadPromises = files.map(async (file) => {
      if (!file.type.startsWith("image/")) {
        errors.push({ file: file.name, error: "Not an image file" });
        return;
      }

      try {
        // Run upload through concurrency limiter
        await uploadLimiter.run(async () => {
          const id = crypto.randomUUID();
          const path = `${user.id}/${projectId}/${id}.${fileExt(file.name)}`;

          addDiagnosticBreadcrumb("photos:storage:upload", {
            file: file.name,
            size: file.size,
            path,
          });

          // Wrap storage upload with timeout
          const uploadResult = await timeoutPromise(
            supabase.storage
              .from(BUCKET)
              .upload(path, file, { contentType: file.type, upsert: false }),
            UPLOAD_TIMEOUT_MS,
            `Upload ${file.name} to storage`,
          );

          const { error: upErr } = uploadResult;
          if (upErr) {
            logger.error("[photos] upload failed", {
              file: file.name,
              error: upErr.message,
            });
            captureUploadError(upErr, {
              projectId,
              fileSizeMb: file.size / (1024 * 1024),
              stage: "storage",
            });
            errors.push({ file: file.name, error: upErr.message });
            return;
          }

          addDiagnosticBreadcrumb("photos:metadata:insert", { file: file.name });

          const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
          const url = pub.publicUrl;

          // Wrap metadata insert with timeout.
          // Promise.resolve() converts the PostgrestBuilder (PromiseLike) to a real Promise.
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
            logger.error("[photos] metadata insert failed", {
              file: file.name,
              error: errMsg,
            });
            captureUploadError(insErr ?? new Error(errMsg), {
              projectId,
              fileSizeMb: file.size / (1024 * 1024),
              stage: "metadata",
            });
            // Roll back the storage upload to keep things consistent.
            await supabase.storage
              .from(BUCKET)
              .remove([path])
              .catch((rollbackErr) => {
                logger.error("[photos] rollback failed", { path, error: String(rollbackErr) });
              });
            errors.push({ file: file.name, error: errMsg });
            return;
          }

          created.push(rowToPhoto(row));
          addDiagnosticBreadcrumb("photos:upload:complete", { file: file.name });
        });
      } catch (err) {
        const errorMsg = isTimeoutError(err) ? "Upload timeout" : String(err);
        logger.error("[photos] file upload failed", {
          file: file.name,
          error: errorMsg,
        });
        captureUploadError(err, {
          projectId,
          fileSizeMb: file.size / (1024 * 1024),
          stage: "storage", // Use storage stage for timeout errors too
        });
        errors.push({ file: file.name, error: errorMsg });
      }
    });

    await Promise.all(uploadPromises);

    if (created.length > 0) {
      const existing = cacheByProject.get(projectId) ?? [];
      cacheByProject.set(projectId, [...existing, ...created]);
      loadedProjects.add(projectId);
      addDiagnosticBreadcrumb("photos:upload:success", {
        projectId,
        filesUploaded: created.length,
        filesFailed: errors.length,
      });
    }

    notify();

    // If there were errors, throw with summary
    if (errors.length > 0) {
      const errorSummary = errors.map((e) => `${e.file}: ${e.error}`).join("; ");
      const err = new Error(`Upload completed with ${errors.length} error(s): ${errorSummary}`);
      captureUploadError(err, {
        projectId,
        fileSizeMb: undefined, // Summary error, not per-file
        stage: "storage", // Use storage for batch errors
      });
      throw err;
    }

    return created;
  },
  async remove(projectId: string, photoId: string): Promise<void> {
    const list = cacheByProject.get(projectId) ?? [];
    const target = list.find((p) => p.id === photoId);
    cacheByProject.set(
      projectId,
      list.filter((p) => p.id !== photoId),
    );
    notify();
    if (target?.storagePath) {
      await supabase.storage
        .from("project-photos")
        .remove([target.storagePath])
        .catch(() => {});
    }
    const { error } = await supabase.from("photos").delete().eq("id", photoId);
    if (error) console.error("[photos] delete failed", error);
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
