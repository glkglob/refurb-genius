/**
 * Client-side upload health probe (ai-upload presentation).
 *
 * Uses the same platform-authenticated write client as photos-write
 * (web pip-auth / native Keychain). Verifies auth + storage write capability
 * with a non-destructive probe object under a dedicated health prefix.
 * Always attempts cleanup in finally.
 */
import { getPhotoWriteClient, PROJECT_PHOTOS_BUCKET } from "@/lib/photos-write";
import { logger } from "@/lib/logger";

export type UploadHealthStatus = "ok" | "auth" | "storage" | "unknown";

export type UploadHealthResult = {
  status: UploadHealthStatus;
  ok: boolean;
  message: string;
  checkedAt: string;
  details?: {
    userId?: string;
    bucket?: string;
    error?: string;
    writeProbed?: boolean;
    cleanupFailed?: boolean;
  };
};

/**
 * Probe upload prerequisites:
 * 1. Valid session
 * 2. Write capability via unique zero-byte probe + immediate remove
 *
 * List-only success is not treated as write readiness.
 */
export async function checkUploadHealth(): Promise<UploadHealthResult> {
  const checkedAt = new Date().toISOString();

  try {
    const client = await getPhotoWriteClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError || !user) {
      return {
        status: "auth",
        ok: false,
        message: "You must be signed in to upload photos.",
        checkedAt,
        details: { error: authError?.message ?? "No session" },
      };
    }

    const probeId = crypto.randomUUID();
    const probePath = `${user.id}/.health/${probeId}.probe`;
    let cleanupFailed = false;

    try {
      const { error: uploadError } = await client.storage
        .from(PROJECT_PHOTOS_BUCKET)
        .upload(probePath, new Blob([new Uint8Array(0)]), {
          contentType: "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        logger.warn("[upload-health] write probe failed", {
          error: uploadError.message,
          bucket: PROJECT_PHOTOS_BUCKET,
        });
        return {
          status: "storage",
          ok: false,
          message:
            "Photo storage is not writable. Check that the project-photos bucket and insert policies are configured.",
          checkedAt,
          details: {
            userId: user.id,
            bucket: PROJECT_PHOTOS_BUCKET,
            error: uploadError.message,
            writeProbed: true,
          },
        };
      }

      return {
        status: "ok",
        ok: true,
        message: "Upload ready (auth + storage write verified).",
        checkedAt,
        details: {
          userId: user.id,
          bucket: PROJECT_PHOTOS_BUCKET,
          writeProbed: true,
        },
      };
    } finally {
      try {
        const { error: removeError } = await client.storage
          .from(PROJECT_PHOTOS_BUCKET)
          .remove([probePath]);
        if (removeError) {
          cleanupFailed = true;
          logger.warn("[upload-health] probe cleanup failed", {
            path: probePath,
            error: removeError.message,
          });
        }
      } catch (cleanupErr) {
        cleanupFailed = true;
        logger.warn("[upload-health] probe cleanup threw", {
          path: probePath,
          error: String(cleanupErr),
        });
      }
      if (cleanupFailed) {
        // Do not fail readiness solely on cleanup — write succeeded.
        logger.info("[upload-health] probe object may remain until next cleanup", {
          path: probePath,
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[upload-health] probe failed", { error: message });
    return {
      status: "unknown",
      ok: false,
      message: "Could not verify upload readiness. Try again shortly.",
      checkedAt,
      details: { error: message },
    };
  }
}
