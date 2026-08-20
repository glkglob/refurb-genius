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

/**
 * Live Preview/Production ownership/path columns differ from generated
 * Database types for some tables. Metadata reads use a structural client so
 * live column names are not forced through stale `user_id` typings.
 */
type MetadataSelectClient = {
  from(table: string): {
    select(column: string): {
      eq(
        column: string,
        value: string,
      ): Promise<{ data: MetadataRow[] | null; error: { message?: string } | null }>;
    };
  };
};

function metadataSelectClient(admin: ServiceRoleClient): MetadataSelectClient {
  return admin as unknown as MetadataSelectClient;
}

async function selectOwnedColumn(
  admin: ServiceRoleClient,
  table: "photos" | "opportunity_photos" | "floorplan_models" | "pitch_deck_exports",
  pathColumn: string,
  ownerColumn: string,
  userId: string,
): Promise<MetadataRow[]> {
  const { data, error } = await metadataSelectClient(admin)
    .from(table)
    .select(pathColumn)
    .eq(ownerColumn, userId);
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
  const photos = await selectOwnedColumn(admin, "photos", "storage_path", "user_id", userId);
  const opportunityPhotos = await selectOwnedColumn(
    admin,
    "opportunity_photos",
    "storage_path",
    "user_id",
    userId,
  );
  const floorplans = await selectOwnedColumn(
    admin,
    "floorplan_models",
    "storage_path",
    "uploaded_by",
    userId,
  );
  const pitchDecks = await selectOwnedColumn(
    admin,
    "pitch_deck_exports",
    "storage_path",
    "created_by",
    userId,
  );
  const galleryPaths = await collectGalleryCoverPaths(admin, userId);

  return {
    "project-photos": [
      ...photos.map((row) => asString(row.storage_path)),
      ...opportunityPhotos.map((row) => asString(row.storage_path)),
    ].filter((path): path is string => Boolean(path)),
    floorplans: floorplans
      .map((row) => asString(row.storage_path))
      .filter((path): path is string => Boolean(path)),
    "pitch-decks": pitchDecks
      .map((row) => asString(row.storage_path))
      .filter((path): path is string => Boolean(path)),
    gallery: galleryPaths,
  };
}

function throwAuthDeleteFailed(): never {
  logger.error("[account-deletion] auth delete failed", { code: "auth_delete_failed" });
  throw new AccountDeletionError("auth_delete_failed", "Account deletion failed.");
}

/**
 * Absence is proven only by a successful admin round-trip with no user.
 * Any non-null error (including 404-shaped gateway errors) is failure, not absence.
 */
function userFromSuccessfulLookup(result: {
  data?: { user?: { id: string } | null } | null;
  error?: { message?: string; status?: number } | null;
}): { id: string } | null {
  if (result.error) {
    throwAuthDeleteFailed();
  }
  const user = result.data?.user;
  if (!user?.id) return null;
  return user;
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

  const existingUser = userFromSuccessfulLookup(await admin.auth.admin.getUserById(userId));
  if (!existingUser) {
    return ACCOUNT_DELETION_SUCCESS;
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (!error) {
    void ACCOUNT_OWNED_STORAGE_BUCKETS;
    return ACCOUNT_DELETION_SUCCESS;
  }

  const verifiedUser = userFromSuccessfulLookup(await admin.auth.admin.getUserById(userId));
  if (verifiedUser) {
    throwAuthDeleteFailed();
  }
  return ACCOUNT_DELETION_SUCCESS;
}
