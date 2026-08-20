import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeAccountDeletion } from "./executeAccountDeletion.server";
import type { ServiceRoleClient } from "@/platform/supabase/service.server";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

const { deleteOwnedStorageForUser } = vi.hoisted(() => ({
  deleteOwnedStorageForUser: vi.fn(),
}));

vi.mock("./deleteOwnedStorage.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./deleteOwnedStorage.server")>();
  return {
    ...actual,
    deleteOwnedStorageForUser: (...args: unknown[]) => deleteOwnedStorageForUser(...args),
  };
});

type TableData = Record<string, Record<string, unknown>[]>;

type AdminUserLookup = {
  data: { user: { id: string } | null };
  error: { message?: string; status?: number } | null;
};

function presentUser(): AdminUserLookup {
  return { data: { user: { id: USER } }, error: null };
}

function absentUser(): AdminUserLookup {
  return { data: { user: null }, error: null };
}

function makeAdmin(options: {
  tables?: TableData;
  getUserByIdResults?: AdminUserLookup[];
  deleteError?: { message: string; status?: number } | null;
}) {
  const lookups = options.getUserByIdResults ?? [presentUser()];
  let lookupIndex = 0;
  const deleteUser = vi.fn(async () => ({ error: options.deleteError ?? null }));
  const getUserById = vi.fn(async () => {
    const next = lookups[Math.min(lookupIndex, lookups.length - 1)] ?? presentUser();
    lookupIndex += 1;
    return next;
  });

  const admin = {
    from(table: string) {
      return {
        select() {
          const chain = {
            eq() {
              return Promise.resolve({ data: options.tables?.[table] ?? [], error: null });
            },
            in() {
              return Promise.resolve({ data: options.tables?.[table] ?? [], error: null });
            },
            then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) {
              return Promise.resolve({ data: options.tables?.[table] ?? [], error: null }).then(
                resolve,
              );
            },
          };
          return chain;
        },
      };
    },
    storage: { from: vi.fn() },
    auth: { admin: { getUserById, deleteUser } },
  };

  return { admin: admin as unknown as ServiceRoleClient, deleteUser, getUserById };
}

describe("executeAccountDeletion", () => {
  beforeEach(() => {
    deleteOwnedStorageForUser.mockReset();
    deleteOwnedStorageForUser.mockResolvedValue(undefined);
  });

  it("does not call auth delete when storage cleanup fails", async () => {
    deleteOwnedStorageForUser.mockRejectedValue(new Error("storage down"));
    const { admin, deleteUser } = makeAdmin({
      tables: {
        photos: [{ storage_path: `${USER}/p/a.jpg` }],
        projects: [{ id: "p1" }],
      },
    });

    await expect(executeAccountDeletion(USER, admin)).rejects.toMatchObject({
      code: "storage_cleanup_failed",
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("calls auth.admin.deleteUser only after storage cleanup", async () => {
    const order: string[] = [];
    deleteOwnedStorageForUser.mockImplementation(async () => {
      order.push("storage");
    });
    const { admin, deleteUser } = makeAdmin({
      tables: {
        photos: [{ storage_path: `${USER}/p/a.jpg` }],
        opportunity_photos: [{ storage_path: `${USER}/o/b.jpg` }],
        floorplan_models: [{ model_url: `${USER}/p/m.glb` }],
        pitch_deck_exports: [{ export_url: `${USER}/p/d.pdf` }],
        projects: [{ id: "p1" }],
        public_gallery_projects: [{ cover_image_url: `${USER}/p/c.jpg` }],
      },
    });
    deleteUser.mockImplementation(async () => {
      order.push("auth");
      return { error: null };
    });

    await expect(executeAccountDeletion(USER, admin)).resolves.toEqual({ success: true });
    expect(order).toEqual(["storage", "auth"]);
    expect(deleteUser).toHaveBeenCalledWith(USER);
    expect(deleteOwnedStorageForUser).toHaveBeenCalledTimes(1);
    const metadata = deleteOwnedStorageForUser.mock.calls[0]?.[2] as Record<string, string[]>;
    expect(metadata["project-photos"]).toEqual([`${USER}/p/a.jpg`, `${USER}/o/b.jpg`]);
    expect(metadata.gallery).toEqual([`${USER}/p/c.jpg`]);
  });

  it("does not issue explicit profiles or analysis_jobs deletes", async () => {
    const { admin } = makeAdmin({ tables: { photos: [], projects: [] } });
    const from = vi.spyOn(admin, "from");
    await executeAccountDeletion(USER, admin);
    const tables = from.mock.calls.map((call) => call[0]);
    expect(tables).not.toContain("profiles");
    expect(tables).not.toContain("analysis_jobs");
  });

  it("returns success without deleteUser when a successful lookup proves the user is absent", async () => {
    const { admin, deleteUser } = makeAdmin({
      getUserByIdResults: [absentUser()],
      tables: { photos: [], projects: [] },
    });
    await expect(executeAccountDeletion(USER, admin)).resolves.toEqual({ success: true });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("forwards metadata paths to storage cleanup including untrusted values", async () => {
    const { admin } = makeAdmin({
      tables: {
        photos: [{ storage_path: `${OTHER}/stolen.jpg` }],
        projects: [],
      },
    });
    await executeAccountDeletion(USER, admin);
    const metadata = deleteOwnedStorageForUser.mock.calls[0]?.[2] as Record<string, string[]>;
    expect(metadata["project-photos"]).toEqual([`${OTHER}/stolen.jpg`]);
  });

  it("throws when pre-delete lookup returns a 404-shaped error instead of proving absence", async () => {
    const { admin, deleteUser } = makeAdmin({
      getUserByIdResults: [
        { data: { user: null }, error: { status: 404, message: "User not found" } },
      ],
      tables: { photos: [], projects: [] },
    });
    await expect(executeAccountDeletion(USER, admin)).rejects.toMatchObject({
      code: "auth_delete_failed",
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("treats deleteUser not-found-shaped errors as success only after a successful absence lookup", async () => {
    const { admin, deleteUser, getUserById } = makeAdmin({
      getUserByIdResults: [presentUser(), absentUser()],
      deleteError: { status: 500, message: "User not found in auth provider" },
      tables: { photos: [], projects: [] },
    });
    await expect(executeAccountDeletion(USER, admin)).resolves.toEqual({ success: true });
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(getUserById).toHaveBeenCalledTimes(2);
  });

  it("throws when deleteUser errors and the follow-up lookup still finds the user", async () => {
    const { admin, deleteUser } = makeAdmin({
      getUserByIdResults: [presentUser(), presentUser()],
      deleteError: { status: 500, message: "User not found in auth provider" },
      tables: { photos: [], projects: [] },
    });
    await expect(executeAccountDeletion(USER, admin)).rejects.toMatchObject({
      code: "auth_delete_failed",
    });
    expect(deleteUser).toHaveBeenCalledTimes(1);
  });

  it("throws when deleteUser errors and the follow-up lookup itself errors", async () => {
    const { admin, deleteUser } = makeAdmin({
      getUserByIdResults: [
        presentUser(),
        { data: { user: null }, error: { status: 500, message: "gateway not found" } },
      ],
      deleteError: { status: 500, message: "User not found in auth provider" },
      tables: { photos: [], projects: [] },
    });
    await expect(executeAccountDeletion(USER, admin)).rejects.toMatchObject({
      code: "auth_delete_failed",
    });
    expect(deleteUser).toHaveBeenCalledTimes(1);
  });
});
