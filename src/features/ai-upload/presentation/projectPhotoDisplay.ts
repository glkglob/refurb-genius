/**
 * Ephemeral project-photo display retrieval.
 *
 * Signs storage_path only. Never persists the signed URL. Never treats
 * ProjectPhoto.url as retrieval authority.
 */
import { PROJECT_PHOTOS_BUCKET } from "@/lib/photos-write";

export const SIGNED_URL_TTL_SECONDS = 900;
export const SIGNED_URL_REFRESH_MARGIN_SECONDS = 60;

/**
 * R1B implementation refinement: keep the cached signed URL until it is
 * inside the refresh margin, instead of staleTime=60s which would remint
 * on every window focus after one minute.
 */
export const SIGNED_URL_STALE_TIME_MS =
  (SIGNED_URL_TTL_SECONDS - SIGNED_URL_REFRESH_MARGIN_SECONDS) * 1000;

export const PROJECT_PHOTO_DISPLAY_GC_TIME_MS = 5 * 60 * 1000;

export type ProjectPhotoDisplayErrorCode = "missing_storage_path" | "invalid_ttl" | "sign_failed";

export class ProjectPhotoDisplayError extends Error {
  readonly name = "ProjectPhotoDisplayError";
  readonly code: ProjectPhotoDisplayErrorCode;

  constructor(message: string, code: ProjectPhotoDisplayErrorCode) {
    super(message);
    this.code = code;
  }
}

export type ProjectPhotoSignedUrl = {
  signedUrl: string;
  expiresAt: number;
  expiresIn: number;
};

export type ProjectPhotoSigningClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number,
      ) => PromiseLike<{
        data: { signedUrl?: string } | null;
        error: { message?: string } | null;
      }>;
    };
  };
};

export function isProjectPhotoDisplayFresh(expiresAt: number, now: number = Date.now()): boolean {
  return expiresAt - now > SIGNED_URL_REFRESH_MARGIN_SECONDS * 1000;
}

/**
 * Create an owner-authorised signed URL for a project-photos object.
 * `storagePath` is the only retrieval authority.
 */
export async function createProjectPhotoSignedUrl(
  client: ProjectPhotoSigningClient,
  storagePath: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<ProjectPhotoSignedUrl> {
  if (typeof storagePath !== "string" || storagePath.trim() === "") {
    throw new ProjectPhotoDisplayError("storagePath is required", "missing_storage_path");
  }
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new ProjectPhotoDisplayError("ttlSeconds must be a positive integer", "invalid_ttl");
  }

  const { data, error } = await client.storage
    .from(PROJECT_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);

  if (error || !data?.signedUrl) {
    throw new ProjectPhotoDisplayError("Failed to create project photo display URL", "sign_failed");
  }

  return {
    signedUrl: data.signedUrl,
    expiresAt: Date.now() + ttlSeconds * 1000,
    expiresIn: ttlSeconds,
  };
}
