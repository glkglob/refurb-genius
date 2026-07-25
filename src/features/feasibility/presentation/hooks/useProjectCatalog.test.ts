import { describe, it, expect } from "vitest";
import type { ProjectWithProgress } from "@/lib/mappers";
import { projectKeys, projectsListQueryOptions } from "@/lib/queries/projects";
import { toProjectCatalog } from "./useProjectCatalog";

function makeProject(overrides: Partial<ProjectWithProgress> = {}): ProjectWithProgress {
  return {
    id: "p1",
    user_id: "u1",
    name: "Alpha",
    address: "1 High St",
    postcode: "E1 1AA",
    region: "London",
    property_type: "Terraced",
    bedrooms: 3,
    bathrooms: 1,
    size_sqm: 90,
    purchase_price: 300_000,
    estimated_gdv: 400_000,
    notes: "n",
    created_at: "2026-01-01T00:00:00.000Z",
    status: "Draft",
    photos_done: true,
    analysis_done: false,
    estimate_done: false,
    report_done: false,
    ...overrides,
  };
}

describe("toProjectCatalog (C4c-6 pure adapter)", () => {
  it("preserves selector and orchestrator fields", () => {
    const input = [makeProject()];
    const out = toProjectCatalog(input);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "p1",
      name: "Alpha",
      address: "1 High St",
      postcode: "E1 1AA",
      region: "London",
      property_type: "Terraced",
      bedrooms: 3,
      bathrooms: 1,
      size_sqm: 90,
      purchase_price: 300_000,
      estimated_gdv: 400_000,
      notes: "n",
      status: "Draft",
    });
  });

  it("does not mutate canonical input rows", () => {
    const row = makeProject();
    const snapshot = { ...row };
    toProjectCatalog([row]);
    expect(row).toEqual(snapshot);
  });

  it("omits progress flags from catalog Project shape", () => {
    const out = toProjectCatalog([makeProject()]);
    expect(out[0]).not.toHaveProperty("photos_done");
    expect(out[0]).not.toHaveProperty("analysis_done");
  });
});

describe("catalog shares canonical list key (C4c-6)", () => {
  it("projectsListQueryOptions key is projectKeys.all (no project-catalog)", () => {
    expect(projectsListQueryOptions().queryKey).toEqual(projectKeys.all);
    expect(JSON.stringify(projectsListQueryOptions().queryKey)).not.toContain("project-catalog");
  });
});
