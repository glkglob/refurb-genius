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

function makeAdmin(options: {
  tables?: TableData;
  userExists?: boolean;
  deleteError?: { message: string; status?: number } | null;
}) {
  const deleteUser = vi.fn(async () => ({ error: options.deleteError ?? null }));
  const getUserById = vi.fn(async () => ({
    data: { user: options.userExists === false ? null : { id: USER } },
    error: options.userExists === false ? { message: "User not found", status: 404 } : null,
  }));

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

  it("returns success without deleteUser when the auth user is already gone", async () => {
    const { admin, deleteUser } = makeAdmin({
      userExists: false,
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
});
