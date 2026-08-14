import { describe, expect, it, vi } from "vitest";
import { listRoomAnalysesWithClient } from "./native-room-analyses";

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

describe("native room-analysis reads", () => {
  it("lists rows via the provided client (RLS-bound, no userId)", async () => {
    const rows = [
      {
        id: "ra1",
        project_id: "proj-1",
        user_id: "u1",
        photo_id: "ph1",
        photo_url: "https://example.com/a.jpg",
        photo_name: "a.jpg",
        room_type: "Kitchen",
        condition_level: "Average",
        refurbishment_level: "Light",
        visible_issues: ["damp"],
        recommended_works: ["paint"],
        ai_summary: "ok",
        confidence_score: 0.8,
        created_at: "2026-01-01T00:00:00.000Z",
        source: "fallback",
      },
    ];
    const { client, from, eq, order } = mockClient({ list: rows });
    await expect(listRoomAnalysesWithClient(client, "proj-1")).resolves.toEqual(rows);
    expect(from).toHaveBeenCalledWith("room_analyses");
    expect(eq).toHaveBeenCalledWith("project_id", "proj-1");
    expect(eq).not.toHaveBeenCalledWith("user_id", expect.anything());
    expect(order).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("returns an empty array when no rows exist", async () => {
    const { client } = mockClient({ list: [] });
    await expect(listRoomAnalysesWithClient(client, "proj-empty")).resolves.toEqual([]);
  });

  it("throws on PostgREST error (does not coerce to [])", async () => {
    const { client } = mockClient({ listError: { message: "JWT expired" } });
    await expect(listRoomAnalysesWithClient(client, "proj-1")).rejects.toThrow(/JWT expired/);
  });

  it("throws when the transport returns a non-array payload", async () => {
    const { client } = mockClient({ list: "<html></html>" });
    await expect(listRoomAnalysesWithClient(client, "proj-1")).rejects.toThrow(/not an array/);
  });
});
