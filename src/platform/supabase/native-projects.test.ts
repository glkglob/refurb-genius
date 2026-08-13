import { describe, it, expect, vi } from "vitest";
import { createProjectWithClient, listProjectsWithClient } from "./native-projects";

function mockClient(opts: {
  userId?: string | null;
  userError?: { message: string } | null;
  list?: unknown[];
  listError?: { message: string } | null;
  insertRow?: unknown;
  insertError?: { message: string } | null;
}) {
  const order = vi.fn(async () => ({
    data: opts.list ?? [],
    error: opts.listError ?? null,
  }));
  const selectList = vi.fn(() => ({ order }));
  const single = vi.fn(async () => ({
    data: opts.insertRow ?? null,
    error: opts.insertError ?? null,
  }));
  const selectInsert = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select: selectInsert }));
  const from = vi.fn(() => ({
    select: selectList,
    insert,
  }));

  return {
    client: {
      from,
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: opts.userId ? { id: opts.userId } : null },
          error: opts.userError ?? null,
        })),
      },
    } as never,
    from,
    insert,
  };
}

describe("native project data plane foundation", () => {
  it("lists projects via provided client (RLS-bound)", async () => {
    const rows = [{ id: "p1", name: "A" }];
    const { client } = mockClient({ list: rows });
    await expect(listProjectsWithClient(client)).resolves.toEqual(rows);
  });

  it("creates project with user_id from auth.getUser only", async () => {
    const row = { id: "p-new", name: "N", user_id: "user-1" };
    const { client, insert } = mockClient({ userId: "user-1", insertRow: row });

    const result = await createProjectWithClient(client, {
      name: "N",
      // Forged identity must not be read — input has no user_id field by type.
    });

    expect(result).toEqual(row);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        name: "N",
      }),
    );
  });

  it("fails closed when native session has no user", async () => {
    const { client, insert } = mockClient({ userId: null });
    await expect(createProjectWithClient(client, { name: "X" })).rejects.toThrow(/signed in/i);
    expect(insert).not.toHaveBeenCalled();
  });
});
