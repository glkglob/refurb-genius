/**
 * Server-only owned-Storage cleanup for account deletion.
 *
 * Implemented buckets (current-main writers):
 *   project-photos, floorplans, pitch-decks, gallery
 *
 * Live estate also includes audit-only buckets (no current-main writer):
 *   floorplan-models, gallery-assets
 * Do not delete those unless a later authorised investigation finds user-owned data.
 */
import { logger } from "@/lib/logger";

export const STORAGE_LIST_PAGE_SIZE = 100;
export const STORAGE_REMOVE_BATCH_SIZE = 100;

export const ACCOUNT_OWNED_STORAGE_BUCKETS = [
  "project-photos",
  "floorplans",
  "pitch-decks",
  "gallery",
] as const;

export const AUDIT_ONLY_STORAGE_BUCKETS = ["floorplan-models", "gallery-assets"] as const;

export type AccountOwnedStorageBucket = (typeof ACCOUNT_OWNED_STORAGE_BUCKETS)[number];

export type StorageListEntry = {
  name: string;
  id: string | null;
};

export type StorageListResult = {
  data: StorageListEntry[] | null;
  error: { message?: string } | null;
};

export type StorageRemoveResult = {
  error: { message?: string; statusCode?: string | number; status?: string | number } | null;
};

export type AccountDeletionStorage = {
  list: (path: string, options: { limit: number; offset: number }) => Promise<StorageListResult>;
  remove: (paths: string[]) => Promise<StorageRemoveResult>;
};

export type AccountDeletionStorageClient = {
  from: (bucket: string) => AccountDeletionStorage;
};

export class AccountDeletionStorageError extends Error {
  readonly code = "storage_cleanup_failed" as const;

  constructor(message = "Required storage cleanup failed.") {
    super(message);
    this.name = "AccountDeletionStorageError";
  }
}

export function isOwnedObjectPath(userId: string, path: string): boolean {
  if (!userId || !path) return false;
  if (path.includes("\0") || path.includes("\\") || path.includes("..")) return false;
  if (path.startsWith("/") || path.startsWith("./")) return false;
  const prefix = `${userId}/`;
  return path.startsWith(prefix) && path.length > prefix.length;
}

export function isStorageObjectMissing(error: {
  message?: string;
  statusCode?: string | number;
  status?: string | number;
}): boolean {
  const code = String(error.statusCode ?? error.status ?? "");
  const msg = `${error.message ?? ""}`.toLowerCase();
  if (code === "404") return true;
  if (code === "400") {
    return (
      msg.includes("not found") ||
      msg.includes("does not exist") ||
      msg.includes("no such file") ||
      msg.includes("object not found")
    );
  }
  return (
    msg.includes("object not found") ||
    msg.includes("not found") ||
    msg.includes("does not exist") ||
    msg.includes("no such file")
  );
}

function joinStoragePath(folder: string, name: string): string {
  if (!folder) return name;
  return `${folder.replace(/\/+$/, "")}/${name}`;
}

async function listOwnedFilesUnderPrefix(
  storage: AccountDeletionStorage,
  userId: string,
  folderPath: string,
): Promise<string[]> {
  const owned: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await storage.list(folderPath, {
      limit: STORAGE_LIST_PAGE_SIZE,
      offset,
    });
    if (error) {
      throw new AccountDeletionStorageError();
    }
    const page = data ?? [];
    if (page.length === 0) break;

    for (const item of page) {
      if (!item?.name) continue;
      const child = joinStoragePath(folderPath, item.name);
      if (!isOwnedObjectPath(userId, child) && child !== userId) {
        continue;
      }
      const isFolder = item.id === null;
      if (isFolder) {
        if (child === userId || isOwnedObjectPath(userId, `${child}/x`)) {
          const nested = await listOwnedFilesUnderPrefix(storage, userId, child);
          owned.push(...nested);
        }
        continue;
      }
      if (isOwnedObjectPath(userId, child)) {
        owned.push(child);
      }
    }

    if (page.length < STORAGE_LIST_PAGE_SIZE) break;
    offset += STORAGE_LIST_PAGE_SIZE;
  }

  return owned;
}

async function removeOwnedPaths(storage: AccountDeletionStorage, paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += STORAGE_REMOVE_BATCH_SIZE) {
    const batch = paths.slice(i, i + STORAGE_REMOVE_BATCH_SIZE);
    const { error } = await storage.remove(batch);
    if (!error) continue;
    if (isStorageObjectMissing(error)) continue;
    throw new AccountDeletionStorageError();
  }
}

export async function deleteOwnedStorageForUser(
  userId: string,
  client: AccountDeletionStorageClient,
  metadataPathsByBucket: Partial<Record<AccountOwnedStorageBucket, string[]>>,
): Promise<void> {
  if (!userId) {
    throw new AccountDeletionStorageError();
  }

  for (const bucket of ACCOUNT_OWNED_STORAGE_BUCKETS) {
    const storage = client.from(bucket);
    const discovered = await listOwnedFilesUnderPrefix(storage, userId, userId);
    const fromMetadata = (metadataPathsByBucket[bucket] ?? []).filter((path) =>
      isOwnedObjectPath(userId, path),
    );
    const dropped = (metadataPathsByBucket[bucket] ?? []).filter(
      (path) => path && !isOwnedObjectPath(userId, path),
    );
    if (dropped.length > 0) {
      logger.warn("[account-deletion] dropped out-of-namespace metadata paths", {
        bucket,
        count: dropped.length,
      });
    }

    const unique = [...new Set([...discovered, ...fromMetadata])];
    await removeOwnedPaths(storage, unique);

    const remaining = await listOwnedFilesUnderPrefix(storage, userId, userId);
    if (remaining.length > 0) {
      throw new AccountDeletionStorageError();
    }
  }
}
