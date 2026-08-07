/**
 * IA-4-R1 — repository uses atomic RPC; columns override JSON for authority.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/serverFns/auth.server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

describe("IA-4-R1 selectDurableRedesignConcept", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("uses select_project_redesign_concept RPC only", async () => {
    const rpcMock = vi.fn(async () => ({
      data: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
        style: "Modern",
        title: "Clean",
        description: JSON.stringify({
          tagline: "Clean",
          palette: [],
          flooring: "Oak",
          lighting: "Warm",
          furniture: "Sofa",
          afterGradient: "g",
          analysisIdentity: "p1",
          isSelected: false,
        }),
        image_url: null,
        analysis_identity: "p1",
        is_selected: true,
      },
      error: null,
    }));

    const { createSupabaseServerClient: create } = await import("@/serverFns/auth.server");
    vi.mocked(create).mockResolvedValue({
      rpc: rpcMock,
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    } as never);

    const { selectDurableRedesignConcept } = await import("./redesign-concepts.repository.server");
    const result = await selectDurableRedesignConcept({
      projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      conceptId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    });

    expect(rpcMock).toHaveBeenCalledWith("select_project_redesign_concept", {
      p_project_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      p_concept_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    });
    expect(result.isSelected).toBe(true);
    expect(result.analysisIdentity).toBe("p1");
  });

  it("column is_selected false wins over JSON isSelected true", async () => {
    const { createSupabaseServerClient: create } = await import("@/serverFns/auth.server");
    const rows = [
      {
        id: "c1",
        style: "Modern",
        title: "t",
        description: JSON.stringify({
          tagline: "t",
          palette: [],
          flooring: "f",
          lighting: "l",
          furniture: "u",
          afterGradient: "g",
          analysisIdentity: "p1",
          isSelected: true,
        }),
        image_url: null,
        analysis_identity: "p1",
        is_selected: false,
      },
    ];
    vi.mocked(create).mockResolvedValue({
      rpc: vi.fn(),
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({ data: rows, error: null }),
          }),
        }),
      }),
    } as never);

    const { listDurableRedesignConcepts } = await import("./redesign-concepts.repository.server");
    const list = await listDurableRedesignConcepts("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");
    expect(list).toHaveLength(1);
    expect(list[0]?.isSelected).toBe(false);
  });

  it("legacy plain description is not selected", async () => {
    const { createSupabaseServerClient: create } = await import("@/serverFns/auth.server");
    vi.mocked(create).mockResolvedValue({
      rpc: vi.fn(),
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [
                {
                  id: "legacy",
                  style: "Modern",
                  title: "Old row",
                  description: "Human readable notes only",
                  image_url: null,
                  analysis_identity: "",
                  is_selected: false,
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    } as never);

    const { listDurableRedesignConcepts } = await import("./redesign-concepts.repository.server");
    const list = await listDurableRedesignConcepts("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");
    expect(list[0]?.isSelected).toBe(false);
    expect(list[0]?.analysisIdentity).toBe("");
  });

  it("RPC failure surfaces error (DB rolls back prior authority)", async () => {
    const { createSupabaseServerClient: create } = await import("@/serverFns/auth.server");
    vi.mocked(create).mockResolvedValue({
      rpc: vi.fn(async () => ({
        data: null,
        error: { message: "redesign_concept_not_found" },
      })),
      from: () => ({}),
    } as never);

    const { selectDurableRedesignConcept } = await import("./redesign-concepts.repository.server");
    await expect(
      selectDurableRedesignConcept({
        projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        conceptId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      }),
    ).rejects.toThrow(/not found/i);
  });
});
