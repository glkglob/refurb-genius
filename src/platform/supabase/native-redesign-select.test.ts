import { describe, expect, it, vi } from "vitest";
import { selectRedesignConceptWithClient } from "./native-redesign-select";

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const CONCEPT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

function selectedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CONCEPT,
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
    ...overrides,
  };
}

describe("selectRedesignConceptWithClient", () => {
  it("calls select_project_redesign_concept without userId", async () => {
    const rpc = vi.fn(async () => ({ data: selectedRow(), error: null }));
    const supabase = { rpc, from: vi.fn() } as never;

    const result = await selectRedesignConceptWithClient(supabase, {
      projectId: PROJECT,
      conceptId: CONCEPT,
    });

    expect(rpc).toHaveBeenCalledWith("select_project_redesign_concept", {
      p_project_id: PROJECT,
      p_concept_id: CONCEPT,
    });
    const firstCall = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(firstCall[1]).not.toHaveProperty("userId");
    expect(firstCall[1]).not.toHaveProperty("p_user_id");
    expect(result.is_selected).toBe(true);
    expect(result.id).toBe(CONCEPT);
  });

  it("throws not found without coercing to empty", async () => {
    const supabase = {
      rpc: vi.fn(async () => ({ data: null, error: { message: "redesign_concept_not_found" } })),
    } as never;
    await expect(
      selectRedesignConceptWithClient(supabase, { projectId: PROJECT, conceptId: CONCEPT }),
    ).rejects.toThrow(/not found/);
  });

  it("throws unauthorized", async () => {
    const supabase = {
      rpc: vi.fn(async () => ({ data: null, error: { message: "project_not_authorised" } })),
    } as never;
    await expect(
      selectRedesignConceptWithClient(supabase, { projectId: PROJECT, conceptId: CONCEPT }),
    ).rejects.toThrow(/Not authorised/);
  });

  it("throws when the RPC returns a malformed non-row", async () => {
    const supabase = {
      rpc: vi.fn(async () => ({ data: { ok: true }, error: null })),
    } as never;
    await expect(
      selectRedesignConceptWithClient(supabase, { projectId: PROJECT, conceptId: CONCEPT }),
    ).rejects.toThrow(/did not persist/);
  });
});
