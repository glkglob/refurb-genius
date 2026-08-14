import { describe, expect, it, vi } from "vitest";
import { listPhotosWithClient } from "./native-photos";

function mockClient(opts: { list?: unknown; listError?: { message: string } | null }) {
  const order = vi.fn(async () => ({
    data: opts.list ?? [],
    error: opts.listError ?? null,
  }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { from } as never,
    from,
    select,
    eq,
    order,
  };
}

describe("native photo reads", () => {
  it("lists rows via the provided client (RLS-bound, no userId)", async () => {
    const rows = [
      {
        id: "ph1",
        project_id: "proj-1",
        url: "https://example.com/a.jpg",
        name: "a.jpg",
        size: 10,
        uploaded_at: "2026-01-01T00:00:00.000Z",
        storage_path: "u/proj-1/a.jpg",
      },
    ];
    const { client, from, eq, order } = mockClient({ list: rows });
    await expect(listPhotosWithClient(client, "proj-1")).resolves.toEqual(rows);
    expect(from).toHaveBeenCalledWith("photos");
    expect(eq).toHaveBeenCalledWith("project_id", "proj-1");
    expect(eq).not.toHaveBeenCalledWith("user_id", expect.anything());
    expect(order).toHaveBeenCalledWith("uploaded_at", { ascending: true });
  });

  it("returns an empty array when no rows exist", async () => {
    const { client } = mockClient({ list: [] });
    await expect(listPhotosWithClient(client, "proj-empty")).resolves.toEqual([]);
  });

  it("throws on PostgREST error (does not coerce to [])", async () => {
    const { client } = mockClient({ listError: { message: "permission denied" } });
    await expect(listPhotosWithClient(client, "proj-1")).rejects.toThrow(/permission denied/);
  });

  it("throws when the transport returns a non-array payload", async () => {
    const { client } = mockClient({ list: { error: "csrf" } });
    await expect(listPhotosWithClient(client, "proj-1")).rejects.toThrow(/not an array/);
  });
});
