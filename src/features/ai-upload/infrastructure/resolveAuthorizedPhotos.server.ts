/**
 * Server-only project/photo ownership resolution for photo analysis.
 * Client-supplied URLs/names are never trusted as authority.
 * Retrieval uses owner-authorised signed URLs from storage_path.
 */
import "@tanstack/react-start/server-only";

import type { AnalysisPhotoSource } from "../domain";
import {
  projectNotAuthorisedError,
  sourceNotAuthorisedError,
  sourceSetMismatchError,
  noSourcePhotosError,
} from "../domain";
import { PROJECT_PHOTOS_BUCKET } from "@/lib/photos-write";

export const AI_SIGNED_URL_TTL_SECONDS = 300;

export type ResolveAuthorizedPhotosInput = {
  userId: string;
  projectId: string;
  /** Client may pass IDs only; URL/name ignored for authority. */
  photoIds: string[];
};

export type AuthorizedProjectPhoto = AnalysisPhotoSource & {
  storagePath: string;
  retrievalUrl: string;
};

/**
 * Re-resolve canonical photos from the database for the authenticated user.
 * Rejects unauthorized/mismatched/duplicate sets before any vision call.
 * Provider retrieval URL is signed from storage_path; durable url is unchanged.
 */
export async function resolveAuthorizedProjectPhotos(
  input: ResolveAuthorizedPhotosInput,
): Promise<AuthorizedProjectPhoto[]> {
  const { userId, projectId, photoIds } = input;

  if (!photoIds.length) {
    throw noSourcePhotosError();
  }
  if (new Set(photoIds).size !== photoIds.length) {
    throw sourceSetMismatchError();
  }

  const { createSupabaseServerClient } = await import("@/serverFns/auth.server");
  const supabase = await createSupabaseServerClient();

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

  const { data: photos, error: photosError } = await supabase
    .from("photos")
    .select("id,url,name,size,project_id,user_id,storage_path")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .in("id", photoIds);

  if (photosError || !photos) {
    throw sourceNotAuthorisedError();
  }

  if (photos.length !== photoIds.length) {
    throw sourceNotAuthorisedError();
  }

  // Preserve client-requested order using server-canonical metadata.
  const byId = new Map(photos.map((p) => [p.id, p]));
  const ordered: AuthorizedProjectPhoto[] = [];
  for (const id of photoIds) {
    const row = byId.get(id);
    if (!row || row.project_id !== projectId || row.user_id !== userId) {
      throw sourceNotAuthorisedError();
    }
    if (!row.storage_path) {
      throw sourceNotAuthorisedError();
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(PROJECT_PHOTOS_BUCKET)
      .createSignedUrl(row.storage_path, AI_SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      throw sourceNotAuthorisedError();
    }

    ordered.push({
      id: row.id,
      url: row.url,
      name: row.name,
      size: row.size ?? undefined,
      storagePath: row.storage_path,
      retrievalUrl: signed.signedUrl,
    });
  }
  return ordered;
}

export type PhotoAnalysisAuthClient = {
  from: (table: string) => unknown;
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
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

type ProjectQuery = {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
      };
    };
  };
};

type PhotoListQuery = {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => {
      eq: (
        column: string,
        value: string,
      ) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
      };
    };
  };
};

type PhotoRow = {
  id: string;
  url: string;
  name: string;
  size?: number | null;
  project_id: string;
  user_id: string;
  storage_path: string | null;
};

/**
 * Bearer/token-client variant: prove ownership, then list every owner photo.
 * Empty catalogue is a successful empty list (caller decides 400 vs continue).
 */
export async function listAuthorizedProjectPhotosWithClient(
  supabase: PhotoAnalysisAuthClient,
  input: { userId: string; projectId: string },
): Promise<AuthorizedProjectPhoto[]> {
  const { userId, projectId } = input;

  const { data: project, error: projectError } = await (supabase.from("projects") as ProjectQuery)
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (projectError || !project) {
    throw projectNotAuthorisedError();
  }

  const { data: photos, error: photosError } = await (supabase.from("photos") as PhotoListQuery)
    .select("id,url,name,size,project_id,user_id,storage_path")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (photosError || !Array.isArray(photos)) {
    throw sourceNotAuthorisedError();
  }

  const ordered: AuthorizedProjectPhoto[] = [];
  for (const raw of photos) {
    const row = raw as PhotoRow;
    if (!row?.id || !row.storage_path || row.project_id !== projectId || row.user_id !== userId) {
      throw sourceNotAuthorisedError();
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(PROJECT_PHOTOS_BUCKET)
      .createSignedUrl(row.storage_path, AI_SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      throw sourceNotAuthorisedError();
    }

    ordered.push({
      id: row.id,
      url: row.url,
      name: row.name,
      size: row.size ?? undefined,
      storagePath: row.storage_path,
      retrievalUrl: signed.signedUrl,
    });
  }

  return ordered;
}
