/**
 * Lightweight client-side upload health probe.
 * Confirms auth session + project-photos bucket reachability without uploading user media.
 */
import { supabase } from "@/platform/supabase/browser";
import { PROJECT_PHOTOS_BUCKET } from "@/lib/photos-write";
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
  };
};

/**
 * Probe upload prerequisites.
 * - Requires a valid session (getUser).
 * - Lists the project-photos bucket root (limit 1) to verify Storage + policies.
 */
export async function checkUploadHealth(): Promise<UploadHealthResult> {
  const checkedAt = new Date().toISOString();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        status: "auth",
        ok: false,
        message: "You must be signed in to upload photos.",
        checkedAt,
        details: { error: authError?.message ?? "No session" },
      };
    }

    const { error: listError } = await supabase.storage
      .from(PROJECT_PHOTOS_BUCKET)
      .list(user.id, { limit: 1 });

    if (listError) {
      logger.warn("[upload-health] storage list failed", {
        error: listError.message,
        bucket: PROJECT_PHOTOS_BUCKET,
      });
      return {
        status: "storage",
        ok: false,
        message:
          "Photo storage is not reachable. Check that the project-photos bucket and policies are configured.",
        checkedAt,
        details: {
          userId: user.id,
          bucket: PROJECT_PHOTOS_BUCKET,
          error: listError.message,
        },
      };
    }

    return {
      status: "ok",
      ok: true,
      message: "Upload ready.",
      checkedAt,
      details: { userId: user.id, bucket: PROJECT_PHOTOS_BUCKET },
    };
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
