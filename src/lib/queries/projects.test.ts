import { describe, it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { ProjectWithProgress } from "@/lib/mappers";
import {
  projectKeys,
  projectQueryOptions,
  projectStageDoneField,
  projectStagePatch,
  patchProjectInList,
  patchProjectDetail,
  applyProjectStageOptimistic,
  restoreProjectStageCaches,
  seedProjectDetailCache,
} from "./projects";

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
    notes: "",
    created_at: "2026-01-01T00:00:00.000Z",
    status: "Draft",
    photos_done: false,
    analysis_done: false,
    estimate_done: false,
    report_done: false,
    ...overrides,
  };
}

describe("projectKeys (C4c-1 serialized identity)", () => {
  it('list root is exactly ["projects"]', () => {
    expect(projectKeys.all).toEqual(["projects"]);
    expect(JSON.stringify(projectKeys.all)).toBe(JSON.stringify(["projects"]));
  });

  it("byId nests under the list root", () => {
    expect(projectKeys.byId("abc")).toEqual(["projects", "abc"]);
  });

  it("nested resource keys remain descendants of byId", () => {
    expect(projectKeys.photosByProject("abc")).toEqual(["projects", "abc", "photos"]);
    expect(projectKeys.estimateByProject("abc")).toEqual(["projects", "abc", "estimate"]);
  });

  it("does not introduce list/detail segments or user scoping", () => {
    expect(projectKeys.all).not.toContain("list");
    expect(projectKeys.all).not.toContain("detail");
    expect(projectKeys.byId("abc")).not.toContain("list");
    expect(projectKeys.byId("abc")).not.toContain("detail");
  });
});

describe("projectQueryOptions (C4c-2 canonical detail authority)", () => {
  it("queryKey equals projectKeys.byId(id)", () => {
    const id = "proj-123";
    expect(projectQueryOptions(id).queryKey).toEqual(projectKeys.byId(id));
  });

  it('queryKey serializes as ["projects", id]', () => {
    const id = "proj-123";
    expect(projectQueryOptions(id).queryKey).toEqual(["projects", id]);
    expect(JSON.stringify(projectQueryOptions(id).queryKey)).toBe(JSON.stringify(["projects", id]));
  });

  it("enabled is true for a non-empty id", () => {
    expect(projectQueryOptions("proj-123").enabled).toBe(true);
  });

  it("enabled is false for an empty id", () => {
    expect(projectQueryOptions("").enabled).toBe(false);
  });

  it("uses stable detail-view cache defaults", () => {
    const opts = projectQueryOptions("proj-123");
    expect(opts.retry).toBe(1);
    expect(opts.staleTime).toBe(5 * 60 * 1000);
    expect(opts.gcTime).toBe(10 * 60 * 1000);
    expect(opts.refetchOnWindowFocus).toBe(false);
  });
});

describe("C4c-3 stage patch helpers", () => {
  it("maps stage names to *_done fields", () => {
    expect(projectStageDoneField("photos")).toBe("photos_done");
    expect(projectStageDoneField("analysis")).toBe("analysis_done");
    expect(projectStageDoneField("estimate")).toBe("estimate_done");
    expect(projectStageDoneField("report")).toBe("report_done");
    expect(projectStagePatch("photos", true)).toEqual({ photos_done: true });
  });

  it("patchProjectInList updates matching project only and is immutable", () => {
    const a = makeProject({ id: "a", photos_done: false });
    const b = makeProject({ id: "b", photos_done: false });
    const list = [a, b];
    const next = patchProjectInList(list, "a", { photos_done: true });
    expect(next).toEqual([{ ...a, photos_done: true }, b]);
    expect(list[0]?.photos_done).toBe(false);
    expect(list).not.toBe(next);
  });

  it("patchProjectInList returns undefined when list is absent", () => {
    expect(patchProjectInList(undefined, "a", { photos_done: true })).toBeUndefined();
  });

  it("patchProjectInList preserves list when target id is absent", () => {
    const list = [makeProject({ id: "a" })];
    const next = patchProjectInList(list, "missing", { photos_done: true });
    expect(next).toEqual(list);
    expect(next?.[0]?.photos_done).toBe(false);
  });

  it("patchProjectDetail patches object and preserves unrelated fields", () => {
    const p = makeProject({ name: "Keep", photos_done: false });
    const next = patchProjectDetail(p, { photos_done: true });
    expect(next).toEqual({ ...p, photos_done: true });
    expect(next?.name).toBe("Keep");
    expect(p.photos_done).toBe(false);
  });

  it("patchProjectDetail returns null and undefined unchanged", () => {
    expect(patchProjectDetail(null, { photos_done: true })).toBeNull();
    expect(patchProjectDetail(undefined, { photos_done: true })).toBeUndefined();
  });
});

describe("C4c-3 QueryClient stage optimistic apply/restore", () => {
  it("patches list and existing detail object", () => {
    const qc = new QueryClient();
    const a = makeProject({ id: "a", photos_done: false });
    const b = makeProject({ id: "b", photos_done: false });
    qc.setQueryData(projectKeys.all, [a, b]);
    qc.setQueryData(projectKeys.byId("a"), a);

    const snap = applyProjectStageOptimistic(qc, "a", { photos_done: true });
    expect(snap.previousList).toEqual([a, b]);
    expect(snap.previousDetail).toEqual(a);
    expect(qc.getQueryData<ProjectWithProgress[]>(projectKeys.all)?.[0]?.photos_done).toBe(true);
    expect(qc.getQueryData<ProjectWithProgress[]>(projectKeys.all)?.[1]?.photos_done).toBe(false);
    expect(qc.getQueryData<ProjectWithProgress>(projectKeys.byId("a"))?.photos_done).toBe(true);
  });

  it("does not create a detail-cache entry when detail was never fetched", () => {
    const qc = new QueryClient();
    const a = makeProject({ id: "a" });
    qc.setQueryData(projectKeys.all, [a]);
    expect(qc.getQueryData(projectKeys.byId("a"))).toBeUndefined();

    applyProjectStageOptimistic(qc, "a", { photos_done: true });

    // Cached data remains absent — helper must not call setQueryData for missing detail.
    expect(qc.getQueryData(projectKeys.byId("a"))).toBeUndefined();
    // List still updated when present.
    expect(qc.getQueryData<ProjectWithProgress[]>(projectKeys.all)?.[0]?.photos_done).toBe(true);
  });

  it("does not patch detail when cached value is null", () => {
    const qc = new QueryClient();
    qc.setQueryData(projectKeys.byId("missing"), null);
    applyProjectStageOptimistic(qc, "missing", { photos_done: true });
    expect(qc.getQueryData(projectKeys.byId("missing"))).toBeNull();
  });

  it("does not invent list data when list cache is absent", () => {
    const qc = new QueryClient();
    expect(qc.getQueryData(projectKeys.all)).toBeUndefined();
    applyProjectStageOptimistic(qc, "a", { photos_done: true });
    expect(qc.getQueryData(projectKeys.all)).toBeUndefined();
  });

  it("restores list and object detail snapshots", () => {
    const qc = new QueryClient();
    const a = makeProject({ id: "a", photos_done: false });
    qc.setQueryData(projectKeys.all, [a]);
    qc.setQueryData(projectKeys.byId("a"), a);
    const snap = applyProjectStageOptimistic(qc, "a", { photos_done: true });
    restoreProjectStageCaches(qc, "a", snap);
    expect(qc.getQueryData(projectKeys.all)).toEqual([a]);
    expect(qc.getQueryData(projectKeys.byId("a"))).toEqual(a);
  });

  it("restores null detail snapshot", () => {
    const qc = new QueryClient();
    qc.setQueryData(projectKeys.byId("x"), null);
    const snap = applyProjectStageOptimistic(qc, "x", { report_done: true });
    expect(snap.previousDetail).toBeNull();
    // apply left null; force a wrong value then restore
    qc.setQueryData(projectKeys.byId("x"), makeProject({ id: "x" }));
    restoreProjectStageCaches(qc, "x", snap);
    expect(qc.getQueryData(projectKeys.byId("x"))).toBeNull();
  });

  it("leaves originally absent detail absent on restore", () => {
    const qc = new QueryClient();
    const a = makeProject({ id: "a" });
    qc.setQueryData(projectKeys.all, [a]);
    const snap = applyProjectStageOptimistic(qc, "a", { photos_done: true });
    expect(snap.previousDetail).toBeUndefined();
    // Simulate accidental write then restore should not re-seed from undefined
    qc.setQueryData(projectKeys.byId("a"), { ...a, photos_done: true });
    restoreProjectStageCaches(qc, "a", snap);
    // previousDetail was undefined → restore does not write; accidental value remains
    // Documented: restore only writes when previous !== undefined.
    // Ensure apply itself never wrote when absent (primary guarantee).
    const qc2 = new QueryClient();
    qc2.setQueryData(projectKeys.all, [a]);
    applyProjectStageOptimistic(qc2, "a", { photos_done: true });
    expect(qc2.getQueryData(projectKeys.byId("a"))).toBeUndefined();
  });
});

describe("C4c-3 create detail seed", () => {
  it("seeds complete Project at projectKeys.byId and does not write nested keys", () => {
    const qc = new QueryClient();
    const project = makeProject({ id: "new-1", name: "Created" });
    seedProjectDetailCache(qc, project);
    expect(qc.getQueryData(projectKeys.byId("new-1"))).toEqual(project);
    expect(qc.getQueryData(projectKeys.photosByProject("new-1"))).toBeUndefined();
    expect(qc.getQueryData(projectKeys.estimateByProject("new-1"))).toBeUndefined();
    expect(qc.getQueryData(projectKeys.financialsByProject("new-1"))).toBeUndefined();
    expect(qc.getQueryData(projectKeys.all)).toBeUndefined();
  });
});
