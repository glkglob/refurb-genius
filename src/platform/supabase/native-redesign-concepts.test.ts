import { describe, expect, it, vi } from "vitest";
import { listRedesignConceptsWithClient } from "./native-redesign-concepts";

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
  };
}

describe("native redesign concept reads", () => {
  it("lists rows via the provided client (RLS-bound)", async () => {
    const rows = [
      {
        id: "c1",
        style: "Modern",
        title: "A",
        description: null,
        image_url: null,
        analysis_identity: "p1",
        is_selected: true,
      },
    ];
    const { client, from, eq } = mockClient({ list: rows });
    await expect(listRedesignConceptsWithClient(client, "proj-1")).resolves.toEqual(rows);
    expect(from).toHaveBeenCalledWith("redesign_concepts");
    expect(eq).toHaveBeenCalledWith("project_id", "proj-1");
  });

  it("returns an empty array when no rows exist", async () => {
    const { client } = mockClient({ list: [] });
    await expect(listRedesignConceptsWithClient(client, "proj-empty")).resolves.toEqual([]);
  });

  it("throws on PostgREST error (does not coerce to [])", async () => {
    const { client } = mockClient({ listError: { message: "permission denied" } });
    await expect(listRedesignConceptsWithClient(client, "proj-1")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("throws when the transport returns a non-array payload", async () => {
    const { client } = mockClient({ list: { error: "csrf" } });
    await expect(listRedesignConceptsWithClient(client, "proj-1")).rejects.toThrow(/not an array/);
  });
});
