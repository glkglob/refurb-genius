/**
 * Shared server-only account deletion runner.
 *
 * Identity is supplied by the caller after cookie requireUser() or Bearer
 * verification. This module never reads request body/query identity.
 *
 * Order: Storage cleanup → verify → auth.admin.deleteUser LAST.
 *
 * Live FK evidence (Control Plane read-only):
 *   profiles.id → auth.users.id ON DELETE CASCADE
 *   analysis_jobs.user_id → auth.users.id ON DELETE CASCADE
 * Do not explicitly delete those tables. Repository baseline reconstruction
 * of analysis_jobs omits the live FK — recorded as schema-reconciliation drift,
 * not compensated here with a migration or extra DELETE.
 */
import type { ServiceRoleClient } from "@/platform/supabase/service.server";
import { logger } from "@/lib/logger";
import {
  ACCOUNT_DELETION_SUCCESS,
  AccountDeletionError,
  type AccountDeletionSuccess,
} from "../domain/accountDeletionContract";
import {
  ACCOUNT_OWNED_STORAGE_BUCKETS,
  type AccountOwnedStorageBucket,
  deleteOwnedStorageForUser,
  isOwnedObjectPath,
  AccountDeletionStorageError,
} from "./deleteOwnedStorage.server";

export { AccountDeletionError };

type MetadataRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function galleryObjectPathFromValue(value: string, userId: string): string | null {
  if (isOwnedObjectPath(userId, value)) return value;
  const marker = "/storage/v1/object/public/gallery/";
  const idx = value.indexOf(marker);
  if (idx < 0) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value.slice(idx + marker.length).split(/[?#]/)[0] ?? "");
  } catch {
    return null;
  }
  return isOwnedObjectPath(userId, decoded) ? decoded : null;
}

function pitchDeckObjectPathFromValue(value: string, userId: string): string | null {
  if (isOwnedObjectPath(userId, value)) return value;
  for (const marker of [
    "/storage/v1/object/public/pitch-decks/",
    "/storage/v1/object/sign/pitch-decks/",
    "/storage/v1/object/authenticated/pitch-decks/",
  ]) {
    const idx = value.indexOf(marker);
    if (idx < 0) continue;
    let decoded: string;
    try {
      decoded = decodeURIComponent(value.slice(idx + marker.length).split(/[?#]/)[0] ?? "");
    } catch {
      return null;
    }
    if (isOwnedObjectPath(userId, decoded)) return decoded;
  }
  return null;
}

async function selectUserColumn(
  admin: ServiceRoleClient,
  table: "photos" | "opportunity_photos" | "floorplan_models" | "pitch_deck_exports",
  column: string,
  userId: string,
): Promise<MetadataRow[]> {
  const { data, error } = await admin.from(table).select(column).eq("user_id", userId);
  if (error) {
    logger.error("[account-deletion] metadata select failed", { table, code: "metadata_select" });
    throw new AccountDeletionError("storage_cleanup_failed", "Required storage cleanup failed.");
  }
  return (data ?? []) as unknown as MetadataRow[];
}

async function collectGalleryCoverPaths(
  admin: ServiceRoleClient,
  userId: string,
): Promise<string[]> {
  const projects = await admin.from("projects").select("id").eq("user_id", userId);
  if (projects.error) {
    logger.error("[account-deletion] metadata select failed", {
      table: "projects",
      code: "metadata_select",
    });
    throw new AccountDeletionError("storage_cleanup_failed", "Required storage cleanup failed.");
  }
  const projectIds = (projects.data ?? [])
    .map((row) => asString((row as { id?: unknown }).id))
    .filter((id): id is string => Boolean(id));
  if (projectIds.length === 0) return [];

  const gallery = await admin
    .from("public_gallery_projects")
    .select("cover_image_url")
    .in("project_id", projectIds);
  if (gallery.error) {
    logger.error("[account-deletion] metadata select failed", {
      table: "public_gallery_projects",
      code: "metadata_select",
    });
    throw new AccountDeletionError("storage_cleanup_failed", "Required storage cleanup failed.");
  }

  return (gallery.data ?? [])
    .map((row) => {
      const raw = asString((row as { cover_image_url?: unknown }).cover_image_url);
      return raw ? galleryObjectPathFromValue(raw, userId) : null;
    })
    .filter((path): path is string => Boolean(path));
}

async function collectMetadataPaths(
  admin: ServiceRoleClient,
  userId: string,
): Promise<Partial<Record<AccountOwnedStorageBucket, string[]>>> {
  const photos = await selectUserColumn(admin, "photos", "storage_path", userId);
  const opportunityPhotos = await selectUserColumn(
    admin,
    "opportunity_photos",
    "storage_path",
    userId,
  );
  const floorplans = await selectUserColumn(admin, "floorplan_models", "model_url", userId);
  const pitchDecks = await selectUserColumn(admin, "pitch_deck_exports", "export_url", userId);
  const galleryPaths = await collectGalleryCoverPaths(admin, userId);

  return {
    "project-photos": [
      ...photos.map((row) => asString(row.storage_path)),
      ...opportunityPhotos.map((row) => asString(row.storage_path)),
    ].filter((path): path is string => Boolean(path)),
    floorplans: floorplans
      .map((row) => asString(row.model_url))
      .filter((path): path is string => Boolean(path)),
    "pitch-decks": pitchDecks
      .map((row) => {
        const raw = asString(row.export_url);
        return raw ? pitchDeckObjectPathFromValue(raw, userId) : null;
      })
      .filter((path): path is string => Boolean(path)),
    gallery: galleryPaths,
  };
}

function isAuthUserMissing(error: { message?: string; status?: number } | null): boolean {
  if (!error) return false;
  const status = error.status;
  const msg = (error.message ?? "").toLowerCase();
  return status === 404 || msg.includes("not found") || msg.includes("user not found");
}

export async function executeAccountDeletion(
  userId: string,
  admin: ServiceRoleClient,
): Promise<AccountDeletionSuccess> {
  if (!userId) {
    throw new AccountDeletionError("auth_delete_failed", "Account deletion failed.");
  }

  try {
    const metadata = await collectMetadataPaths(admin, userId);
    await deleteOwnedStorageForUser(userId, admin.storage, metadata);
  } catch (err) {
    if (err instanceof AccountDeletionStorageError || err instanceof AccountDeletionError) {
      throw err instanceof AccountDeletionError
        ? err
        : new AccountDeletionError("storage_cleanup_failed", "Required storage cleanup failed.");
    }
    logger.error("[account-deletion] storage cleanup failed", { code: "storage_cleanup_failed" });
    throw new AccountDeletionError("storage_cleanup_failed", "Required storage cleanup failed.");
  }

  const existing = await admin.auth.admin.getUserById(userId);
  if (existing.error && !isAuthUserMissing(existing.error)) {
    logger.error("[account-deletion] auth lookup failed", { code: "auth_delete_failed" });
    throw new AccountDeletionError("auth_delete_failed", "Account deletion failed.");
  }
  if (!existing.data?.user || isAuthUserMissing(existing.error)) {
    // Auth user already gone after Storage cleanup (lost prior success / retry).
    return ACCOUNT_DELETION_SUCCESS;
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error && !isAuthUserMissing(error)) {
    logger.error("[account-deletion] auth delete failed", { code: "auth_delete_failed" });
    throw new AccountDeletionError("auth_delete_failed", "Account deletion failed.");
  }

  void ACCOUNT_OWNED_STORAGE_BUCKETS;
  return ACCOUNT_DELETION_SUCCESS;
}
