/**
 * Server-only project/photo ownership resolution for photo analysis.
 * Client-supplied URLs/names are never trusted as authority.
 * Retrieval uses owner-authorised signed URLs from storage_path.
 *
 * Canonical resolution and retrieval signing are separate:
 * resolve first (no retrievalUrl), then sign only the next provider batch.
 */
import "@tanstack/react-start/server-only";

import type { AnalysisPhotoSource } from "../domain";
import {
  projectNotAuthorisedError,
  sourceNotAuthorisedError,
  noSourcePhotosError,
  duplicatePhotoIdsError,
  staleCatalogueError,
  retrievalUnavailableError,
} from "../domain";
import { PROJECT_PHOTOS_BUCKET } from "@/lib/photos-write";

export const AI_SIGNED_URL_TTL_SECONDS = 300;

/** Injected authenticated client. Structural so features do not import the vendor SDK. */
export type PhotoAnalysisAuthClient = {
  // `any` keeps the PostgREST builder assignable without importing the vendor SDK.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number,
      ) => Promise<{ data: { signedUrl?: string } | null; error: { message?: string } | null }>;
    };
  };
};

export type ResolveAuthorizedPhotosInput = {
  userId: string;
  projectId: string;
  /** Client may pass IDs only; URL/name ignored for authority. */
  photoIds: string[];
  /** Injected authenticated client. Required for canonical resolution. */
  supabase: PhotoAnalysisAuthClient;
  /**
   * exact — native: client IDs must equal the complete owned catalogue.
   * requested — web: existing requested-set IN(photoIds) semantics.
   */
  catalogueMode: "exact" | "requested";
};

export type CanonicalAuthorizedPhoto = AnalysisPhotoSource & {
  storagePath: string;
};

export type AuthorizedProjectPhoto = CanonicalAuthorizedPhoto & {
  retrievalUrl: string;
};

type PhotoRow = {
  id: string;
  url: string;
  name: string;
  size: number | null;
  project_id: string;
  user_id: string;
  storage_path: string | null;
};

function assertRequestedIds(photoIds: string[]): void {
  if (!photoIds.length) {
    throw noSourcePhotosError();
  }
  if (new Set(photoIds).size !== photoIds.length) {
    throw duplicatePhotoIdsError();
  }
}

function toCanonical(row: PhotoRow): CanonicalAuthorizedPhoto {
  if (!row.storage_path) {
    throw sourceNotAuthorisedError();
  }
  return {
    id: row.id,
    url: row.url,
    name: row.name,
    size: row.size ?? undefined,
    storagePath: row.storage_path,
  };
}

/**
 * Load the authorised canonical catalogue. Does not mint retrieval URLs.
 * Equality is never proved by `.in(photoIds)` alone.
 */
export async function resolveCanonicalAuthorizedPhotos(
  input: ResolveAuthorizedPhotosInput,
): Promise<CanonicalAuthorizedPhoto[]> {
  const { userId, projectId, photoIds, supabase, catalogueMode } = input;

  assertRequestedIds(photoIds);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (projectError || !project) {
    // Do not leak existence of another user's project.
    throw projectNotAuthorisedError();
  }

  const photosQuery = supabase
    .from("photos")
    .select("id,url,name,size,project_id,user_id,storage_path")
    .eq("project_id", projectId)
    .eq("user_id", userId);

  const { data: photos, error: photosError } =
    catalogueMode === "requested" ? await photosQuery.in("id", photoIds) : await photosQuery;

  if (photosError || !photos) {
    throw sourceNotAuthorisedError();
  }

  const rows = photos as PhotoRow[];

  if (catalogueMode === "exact") {
    const catalogueIds = new Set(rows.map((row) => row.id));
    if (catalogueIds.size !== rows.length) {
      throw sourceNotAuthorisedError();
    }
    const requested = new Set(photoIds);
    if (requested.size !== catalogueIds.size) {
      throw staleCatalogueError();
    }
    for (const id of requested) {
      if (!catalogueIds.has(id)) {
        throw staleCatalogueError();
      }
    }
  } else if (rows.length !== photoIds.length) {
    throw sourceNotAuthorisedError();
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered: CanonicalAuthorizedPhoto[] = [];
  for (const id of photoIds) {
    const row = byId.get(id);
    if (!row || row.project_id !== projectId || row.user_id !== userId) {
      throw sourceNotAuthorisedError();
    }
    ordered.push(toCanonical(row));
  }
  return ordered;
}

/**
 * Mint short-lived private retrieval URLs for one provider batch only.
 * Signing uses canonical storage_path + TTL 300. No public/durable fallback.
 */
export async function signAuthorizedPhotoBatch(
  supabase: PhotoAnalysisAuthClient,
  batch: CanonicalAuthorizedPhoto[],
): Promise<AuthorizedProjectPhoto[]> {
  const signed: AuthorizedProjectPhoto[] = [];
  for (const photo of batch) {
    const { data, error } = await supabase.storage
      .from(PROJECT_PHOTOS_BUCKET)
      .createSignedUrl(photo.storagePath, AI_SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      throw retrievalUnavailableError();
    }

    signed.push({
      ...photo,
      retrievalUrl: data.signedUrl,
    });
  }
  return signed;
}

/**
 * Web compatibility wrapper: requested-set resolution + sign the requested set.
 * Observable web requested-set semantics are unchanged.
 * Prefer the split APIs for native exact-catalogue JIT signing.
 */
export async function resolveAuthorizedProjectPhotos(input: {
  userId: string;
  projectId: string;
  photoIds: string[];
  supabase?: PhotoAnalysisAuthClient;
}): Promise<AuthorizedProjectPhoto[]> {
  const supabase =
    input.supabase ??
    (await (await import("@/serverFns/auth.server")).createSupabaseServerClient());

  const canonical = await resolveCanonicalAuthorizedPhotos({
    userId: input.userId,
    projectId: input.projectId,
    photoIds: input.photoIds,
    supabase,
    catalogueMode: "requested",
  });
  return signAuthorizedPhotoBatch(supabase, canonical);
}
