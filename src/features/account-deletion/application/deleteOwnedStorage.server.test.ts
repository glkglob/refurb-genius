import { describe, expect, it } from "vitest";
import {
  ACCOUNT_OWNED_STORAGE_BUCKETS,
  AUDIT_ONLY_STORAGE_BUCKETS,
  STORAGE_LIST_PAGE_SIZE,
  STORAGE_REMOVE_BATCH_SIZE,
  deleteOwnedStorageForUser,
  isOwnedObjectPath,
  isStorageObjectMissing,
  type AccountDeletionStorage,
  type AccountDeletionStorageClient,
  type StorageListEntry,
} from "./deleteOwnedStorage.server";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

function file(name: string): StorageListEntry {
  return { name, id: `${name}-id` };
}

function folder(name: string): StorageListEntry {
  return { name, id: null };
}

function memoryStorage(initial: Record<string, string[]>) {
  const objects = new Map<string, Set<string>>();
  for (const [bucket, paths] of Object.entries(initial)) {
    objects.set(bucket, new Set(paths));
  }
  const removeCalls: Array<{ bucket: string; paths: string[] }> = [];
  const listCalls: Array<{ bucket: string; path: string; offset: number; limit: number }> = [];

  const client: AccountDeletionStorageClient = {
    from(bucket: string): AccountDeletionStorage {
      return {
        async list(path, options) {
          listCalls.push({ bucket, path, offset: options.offset, limit: options.limit });
          const prefix = path.endsWith("/") || path === "" ? path : `${path}/`;
          const all = [...(objects.get(bucket) ?? [])];
          const children = new Map<string, StorageListEntry>();
          for (const objectPath of all) {
            if (path === "" && !objectPath.includes("/")) {
              children.set(objectPath, file(objectPath));
              continue;
            }
            if (path && objectPath === path) continue;
            if (path && !objectPath.startsWith(prefix)) continue;
            const rest = path ? objectPath.slice(prefix.length) : objectPath;
            const [head, ...tail] = rest.split("/");
            if (!head) continue;
            if (tail.length === 0) children.set(head, file(head));
            else if (!children.has(head)) children.set(head, folder(head));
          }
          const page = [...children.values()].slice(options.offset, options.offset + options.limit);
          return { data: page, error: null };
        },
        async remove(paths) {
          removeCalls.push({ bucket, paths: [...paths] });
          const set = objects.get(bucket) ?? new Set();
          for (const p of paths) set.delete(p);
          objects.set(bucket, set);
          return { error: null };
        },
      };
    },
  };

  return { client, objects, removeCalls, listCalls };
}

describe("owned path isolation", () => {
  it("accepts only objects under the authoritative user prefix", () => {
    expect(isOwnedObjectPath(USER, `${USER}/proj/p.jpg`)).toBe(true);
    expect(isOwnedObjectPath(USER, USER)).toBe(false);
    expect(isOwnedObjectPath(USER, `${OTHER}/proj/p.jpg`)).toBe(false);
    expect(isOwnedObjectPath(USER, `../${USER}/x`)).toBe(false);
    expect(isOwnedObjectPath(USER, `/${USER}/x`)).toBe(false);
  });

  it("treats 404-style storage errors as already missing", () => {
    expect(isStorageObjectMissing({ statusCode: 404, message: "not found" })).toBe(true);
    expect(isStorageObjectMissing({ message: "permission denied" })).toBe(false);
  });

  it("does not implement audit-only live buckets", () => {
    expect(ACCOUNT_OWNED_STORAGE_BUCKETS).toEqual([
      "project-photos",
      "floorplans",
      "pitch-decks",
      "gallery",
    ]);
    expect(AUDIT_ONLY_STORAGE_BUCKETS).toEqual(["floorplan-models", "gallery-assets"]);
    expect(STORAGE_LIST_PAGE_SIZE).toBe(100);
    expect(STORAGE_REMOVE_BATCH_SIZE).toBe(100);
    expect(STORAGE_REMOVE_BATCH_SIZE).toBeLessThanOrEqual(1000);
  });
});

describe("deleteOwnedStorageForUser", () => {
  it("recurses folders, paginates beyond one list page, and batches removes at 100", async () => {
    const photoPaths = Array.from({ length: 130 }, (_, i) => `${USER}/proj/photo-${i}.jpg`);
    const { client, objects, removeCalls, listCalls } = memoryStorage({
      "project-photos": photoPaths,
      floorplans: [`${USER}/proj/model.glb`],
      "pitch-decks": [`${USER}/proj/deck.pdf`],
      gallery: [`${USER}/proj/cover.jpg`],
    });

    await deleteOwnedStorageForUser(USER, client, {});

    expect(objects.get("project-photos")?.size).toBe(0);
    expect(objects.get("floorplans")?.size).toBe(0);
    expect(objects.get("gallery")?.size).toBe(0);
    expect(listCalls.some((call) => call.limit === 100 && call.offset === 100)).toBe(true);
    const photoRemoves = removeCalls.filter((call) => call.bucket === "project-photos");
    expect(photoRemoves[0]?.paths).toHaveLength(100);
    expect(photoRemoves[1]?.paths).toHaveLength(30);
    expect(photoRemoves.every((call) => call.paths.length <= 100)).toBe(true);
  });

  it("drops out-of-namespace metadata and does not remove another user", async () => {
    const { client, objects, removeCalls } = memoryStorage({
      "project-photos": [`${USER}/proj/own.jpg`, `${OTHER}/proj/secret.jpg`],
      floorplans: [],
      "pitch-decks": [],
      gallery: [],
    });

    await deleteOwnedStorageForUser(USER, client, {
      "project-photos": [`${OTHER}/proj/forged.jpg`, `${USER}/proj/meta.jpg`],
    });

    const removed = removeCalls.flatMap((call) => call.paths);
    expect(removed).toContain(`${USER}/proj/own.jpg`);
    expect(removed).not.toContain(`${OTHER}/proj/secret.jpg`);
    expect(removed).not.toContain(`${OTHER}/proj/forged.jpg`);
    expect(objects.get("project-photos")?.has(`${OTHER}/proj/secret.jpg`)).toBe(true);
  });

  it("treats already-missing remove errors as success", async () => {
    const { client } = memoryStorage({
      "project-photos": [],
      floorplans: [],
      "pitch-decks": [],
      gallery: [],
    });
    const originalFrom = client.from.bind(client);
    client.from = (bucket) => {
      const storage = originalFrom(bucket);
      return {
        ...storage,
        async remove() {
          return { error: { message: "Object not found", statusCode: 404 } };
        },
      };
    };

    await expect(
      deleteOwnedStorageForUser(USER, client, {
        "project-photos": [`${USER}/proj/gone.jpg`],
      }),
    ).resolves.toBeUndefined();
  });

  it("fails closed on genuine storage errors and leaves remaining objects", async () => {
    const { client, objects } = memoryStorage({
      "project-photos": [`${USER}/proj/keep.jpg`],
      floorplans: [],
      "pitch-decks": [],
      gallery: [],
    });
    const originalFrom = client.from.bind(client);
    client.from = (bucket) => {
      const storage = originalFrom(bucket);
      return {
        ...storage,
        async remove() {
          return { error: { message: "permission denied", statusCode: 403 } };
        },
      };
    };

    await expect(deleteOwnedStorageForUser(USER, client, {})).rejects.toMatchObject({
      code: "storage_cleanup_failed",
    });
    expect(objects.get("project-photos")?.has(`${USER}/proj/keep.jpg`)).toBe(true);
  });
});
