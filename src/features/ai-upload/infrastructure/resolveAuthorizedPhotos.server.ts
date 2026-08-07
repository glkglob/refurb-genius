/**
 * Server-only project/photo ownership resolution for photo analysis.
 * Client-supplied URLs/names are never trusted as authority.
 */
import "@tanstack/react-start/server-only";

import type { AnalysisPhotoSource } from "../domain";
import {
  projectNotAuthorisedError,
  sourceNotAuthorisedError,
  sourceSetMismatchError,
  noSourcePhotosError,
} from "../domain";

export type ResolveAuthorizedPhotosInput = {
  userId: string;
  projectId: string;
  /** Client may pass IDs only; URL/name ignored for authority. */
  photoIds: string[];
};

/**
 * Re-resolve canonical photos from the database for the authenticated user.
 * Rejects unauthorized/mismatched/duplicate sets before any vision call.
 */
export async function resolveAuthorizedProjectPhotos(
  input: ResolveAuthorizedPhotosInput,
): Promise<AnalysisPhotoSource[]> {
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
    .select("id,url,name,size,project_id,user_id")
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
  const ordered: AnalysisPhotoSource[] = [];
  for (const id of photoIds) {
    const row = byId.get(id);
    if (!row || row.project_id !== projectId || row.user_id !== userId) {
      throw sourceNotAuthorisedError();
    }
    ordered.push({
      id: row.id,
      url: row.url,
      name: row.name,
      size: row.size ?? undefined,
    });
  }
  return ordered;
}
