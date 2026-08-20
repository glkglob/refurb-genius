import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeAccountDeletion } from "./executeAccountDeletion.server";
import type { ServiceRoleClient } from "@/platform/supabase/service.server";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "executeAccountDeletion.server.ts"),
  "utf8",
);

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

type CapturedQuery = {
  table: string;
  select?: string;
  eqColumn?: string;
  eqValue?: unknown;
  inColumn?: string;
};

function makeAdmin(options: {
  tables?: TableData;
  tableErrors?: Record<string, { message: string }>;
  getUserByIdResults?: AdminUserLookup[];
  deleteError?: { message: string; status?: number } | null;
}) {
  const lookups = options.getUserByIdResults ?? [presentUser()];
  let lookupIndex = 0;
  const queries: CapturedQuery[] = [];
  const deleteUser = vi.fn(async () => ({ error: options.deleteError ?? null }));
  const getUserById = vi.fn(async () => {
    const next = lookups[Math.min(lookupIndex, lookups.length - 1)] ?? presentUser();
    lookupIndex += 1;
    return next;
  });

  const resolveTable = (table: string) =>
    Promise.resolve({
      data: options.tableErrors?.[table] ? null : (options.tables?.[table] ?? []),
      error: options.tableErrors?.[table] ?? null,
    });

  const admin = {
    from(table: string) {
      return {
        select(column?: string) {
          const captured: CapturedQuery = { table, select: column };
          queries.push(captured);
          const chain = {
            eq(eqColumn: string, eqValue: unknown) {
              captured.eqColumn = eqColumn;
              captured.eqValue = eqValue;
              return resolveTable(table);
            },
            in(inColumn: string) {
              captured.inColumn = inColumn;
              return resolveTable(table);
            },
            then(
              resolve: (value: {
                data: Record<string, unknown>[] | null;
                error: { message: string } | null;
              }) => unknown,
            ) {
              return resolveTable(table).then(resolve);
            },
          };
          return chain;
        },
      };
    },
    storage: { from: vi.fn() },
    auth: { admin: { getUserById, deleteUser } },
  };

  return { admin: admin as unknown as ServiceRoleClient, deleteUser, getUserById, queries };
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
    const { admin, deleteUser, queries } = makeAdmin({
      tables: {
        photos: [{ storage_path: `${USER}/p/a.jpg` }],
        opportunity_photos: [{ storage_path: `${USER}/o/b.jpg` }],
        floorplan_models: [{ storage_path: `${USER}/p/m.glb` }],
        pitch_deck_exports: [{ storage_path: `${USER}/p/d.pdf` }],
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
    expect(metadata.floorplans).toEqual([`${USER}/p/m.glb`]);
    expect(metadata["pitch-decks"]).toEqual([`${USER}/p/d.pdf`]);
    expect(metadata.gallery).toEqual([`${USER}/p/c.jpg`]);
    expect(queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "photos",
          select: "storage_path",
          eqColumn: "user_id",
          eqValue: USER,
        }),
        expect.objectContaining({
          table: "opportunity_photos",
          select: "storage_path",
          eqColumn: "user_id",
          eqValue: USER,
        }),
        expect.objectContaining({
          table: "floorplan_models",
          select: "storage_path",
          eqColumn: "uploaded_by",
          eqValue: USER,
        }),
        expect.objectContaining({
          table: "pitch_deck_exports",
          select: "storage_path",
          eqColumn: "created_by",
          eqValue: USER,
        }),
      ]),
    );
    expect(queries.filter((q) => q.table === "floorplan_models")).toEqual([
      expect.objectContaining({
        select: "storage_path",
        eqColumn: "uploaded_by",
        eqValue: USER,
      }),
    ]);
    expect(queries.filter((q) => q.table === "pitch_deck_exports")).toEqual([
      expect.objectContaining({
        select: "storage_path",
        eqColumn: "created_by",
        eqValue: USER,
      }),
    ]);
  });

  it("throws storage_cleanup_failed when a metadata select fails and does not delete auth", async () => {
    const { admin, deleteUser } = makeAdmin({
      tables: { photos: [], projects: [] },
      tableErrors: { floorplan_models: { message: "column user_id does not exist" } },
    });
    await expect(executeAccountDeletion(USER, admin)).rejects.toMatchObject({
      code: "storage_cleanup_failed",
    });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(deleteOwnedStorageForUser).not.toHaveBeenCalled();
  });

  it("does not query obsolete floorplan/pitch-deck columns", () => {
    expect(SRC).toMatch(
      /selectOwnedColumn\(\s*admin,\s*"floorplan_models",\s*"storage_path",\s*"uploaded_by"/,
    );
    expect(SRC).toMatch(
      /selectOwnedColumn\(\s*admin,\s*"pitch_deck_exports",\s*"storage_path",\s*"created_by"/,
    );
    expect(SRC).not.toMatch(/model_url/);
    expect(SRC).not.toMatch(/export_url/);
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
