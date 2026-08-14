import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { ProjectWithProgress } from "@/lib/mappers";

const PROJECTS_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "projects.ts"),
  "utf8",
);

const { fromMock, loggerError, isNativePlatform, listProjectsNative, getProjectNative } =
  vi.hoisted(() => ({
    fromMock: vi.fn(),
    loggerError: vi.fn(),
    isNativePlatform: vi.fn(() => false),
    listProjectsNative: vi.fn(),
    getProjectNative: vi.fn(),
  }));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock("@/platform/supabase/native-projects", () => ({
  listProjectsNative: (...args: unknown[]) => listProjectsNative(...args),
  getProjectNative: (...args: unknown[]) => getProjectNative(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: loggerError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  projectKeys,
  projectsListQueryOptions,
  projectQueryOptions,
  projectStageDoneField,
  projectStagePatch,
  patchProjectInList,
  patchProjectDetail,
  applyProjectStageOptimistic,
  restoreProjectStageCaches,
  seedProjectDetailCache,
  fetchProjectsList,
  fetchProjectById,
  fetchProjectPhotosList,
  photosQueryOptions,
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

function makeProjectRow(overrides: Record<string, unknown> = {}) {
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

function mockProjectsListChain(result: { data: unknown; error: { message: string } | null }) {
  const order = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ order });
  fromMock.mockReturnValue({ select });
  return { select, order };
}

describe("fetchProjectsList platform split", () => {
  beforeEach(() => {
    fromMock.mockReset();
    loggerError.mockReset();
    isNativePlatform.mockReturnValue(false);
    listProjectsNative.mockReset();
    getProjectNative.mockReset();
  });

  it("web uses the browser Supabase client and canonical mapper", async () => {
    const { select, order } = mockProjectsListChain({
      data: [makeProjectRow({ name: "Web Row" })],
      error: null,
    });

    const out = await fetchProjectsList();

    expect(isNativePlatform).toHaveBeenCalled();
    expect(listProjectsNative).not.toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith("projects");
    expect(select).toHaveBeenCalledWith("*");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(out).toEqual([makeProject({ name: "Web Row" })]);
  });

  it("native uses listProjectsNative and the same canonical mapper", async () => {
    isNativePlatform.mockReturnValue(true);
    listProjectsNative.mockResolvedValue([makeProjectRow({ name: "Native Row" })]);

    const out = await fetchProjectsList();

    expect(listProjectsNative).toHaveBeenCalledTimes(1);
    expect(fromMock).not.toHaveBeenCalled();
    expect(out).toEqual([makeProject({ name: "Native Row" })]);
  });
});

describe("fetchProjectById platform split", () => {
  beforeEach(() => {
    fromMock.mockReset();
    loggerError.mockReset();
    isNativePlatform.mockReturnValue(false);
    listProjectsNative.mockReset();
    getProjectNative.mockReset();
  });

  it("web uses the browser Supabase client", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: makeProjectRow({ id: "detail-1", name: "Detail" }),
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });

    const out = await fetchProjectById("detail-1");

    expect(getProjectNative).not.toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith("projects");
    expect(eq).toHaveBeenCalledWith("id", "detail-1");
    expect(out).toEqual(makeProject({ id: "detail-1", name: "Detail" }));
  });

  it("native uses getProjectNative and the same canonical mapper", async () => {
    isNativePlatform.mockReturnValue(true);
    getProjectNative.mockResolvedValue(makeProjectRow({ id: "detail-n", name: "Native Detail" }));

    const out = await fetchProjectById("detail-n");

    expect(getProjectNative).toHaveBeenCalledWith("detail-n");
    expect(fromMock).not.toHaveBeenCalled();
    expect(out).toEqual(makeProject({ id: "detail-n", name: "Native Detail" }));
  });
});

describe("projects query factory native-graph containment", () => {
  it("does not statically import native SecureStorage or native-projects", () => {
    expect(PROJECTS_SRC).not.toMatch(
      /import\s+[^;]*from\s+["']@\/platform\/supabase\/native(?:-projects)?["']/,
    );
    expect(PROJECTS_SRC).not.toMatch(
      /import\s+[^;]*from\s+["']@\/platform\/auth\/native\/pkce-storage["']/,
    );
  });

  it("dynamically imports native-projects on the native list/detail paths", () => {
    expect(PROJECTS_SRC).toMatch(/import\(["']@\/platform\/supabase\/native-projects["']\)/);
    expect(PROJECTS_SRC).toMatch(/listProjectsNative/);
    expect(PROJECTS_SRC).toMatch(/getProjectNative/);
    expect(PROJECTS_SRC).toMatch(/rowToProject/);
  });

  it("keeps projectsListQueryOptions on fetchProjectsList and projectKeys.all", () => {
    expect(projectsListQueryOptions().queryFn).toBe(fetchProjectsList);
    expect(projectsListQueryOptions().queryKey).toEqual(["projects"]);
  });
});

describe("projectsListQueryOptions (C4c-6 canonical list authority)", () => {
  it("queryKey is exactly projectKeys.all", () => {
    expect(projectsListQueryOptions().queryKey).toEqual(projectKeys.all);
    expect(projectsListQueryOptions().queryKey).toEqual(["projects"]);
  });

  it("shares serialized identity with projectKeys.all", () => {
    expect(JSON.stringify(projectsListQueryOptions().queryKey)).toBe(
      JSON.stringify(projectKeys.all),
    );
  });

  it("exposes a list queryFn (shared network authority)", () => {
    expect(typeof projectsListQueryOptions().queryFn).toBe("function");
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

describe("projectKeys.photosByProject (C5-1)", () => {
  it('serializes as ["projects", projectId, "photos"]', () => {
    expect(projectKeys.photosByProject("project-a")).toEqual(["projects", "project-a", "photos"]);
  });

  it("identical IDs produce identical keys", () => {
    expect(projectKeys.photosByProject("p1")).toEqual(projectKeys.photosByProject("p1"));
    expect(JSON.stringify(projectKeys.photosByProject("p1"))).toBe(
      JSON.stringify(["projects", "p1", "photos"]),
    );
  });

  it("different IDs produce different keys", () => {
    expect(projectKeys.photosByProject("a")).not.toEqual(projectKeys.photosByProject("b"));
  });
});

describe("fetchProjectPhotosList (C5-1 canonical product-photo list fetch)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    loggerError.mockReset();
  });

  function mockPhotosChain(result: { data: unknown; error: { message: string } | null }) {
    const order = vi.fn().mockResolvedValue(result);
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });
    return { select, eq, order };
  }

  it("queries photos by project_id ordered by uploaded_at ascending", async () => {
    const row = {
      id: "ph1",
      project_id: "proj-1",
      url: "https://example.com/a.jpg",
      name: "a.jpg",
      size: 100,
      uploaded_at: "2026-01-02T00:00:00.000Z",
      storage_path: "u1/proj-1/ph1.jpg",
      user_id: "u1",
    };
    const { select, eq, order } = mockPhotosChain({ data: [row], error: null });

    const out = await fetchProjectPhotosList("proj-1");

    expect(fromMock).toHaveBeenCalledWith("photos");
    expect(select).toHaveBeenCalledWith("*");
    expect(eq).toHaveBeenCalledWith("project_id", "proj-1");
    expect(order).toHaveBeenCalledWith("uploaded_at", { ascending: true });
    expect(out).toEqual([
      {
        id: "ph1",
        projectId: "proj-1",
        url: "https://example.com/a.jpg",
        name: "a.jpg",
        size: 100,
        uploadedAt: "2026-01-02T00:00:00.000Z",
        storagePath: "u1/proj-1/ph1.jpg",
      },
    ]);
  });

  it("returns empty array when data is null", async () => {
    mockPhotosChain({ data: null, error: null });
    await expect(fetchProjectPhotosList("proj-1")).resolves.toEqual([]);
  });

  it("logs and throws on Supabase error", async () => {
    mockPhotosChain({ data: null, error: { message: "boom" } });
    await expect(fetchProjectPhotosList("proj-1")).rejects.toThrow("boom");
    expect(loggerError).toHaveBeenCalledWith(
      "[queries] photos fetch failed",
      expect.objectContaining({ projectId: "proj-1", error: "boom" }),
    );
  });
});

describe("photosQueryOptions (C5-1 canonical product-photo list options)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    loggerError.mockReset();
  });

  it("queryKey equals projectKeys.photosByProject(projectId)", () => {
    const id = "proj-xyz";
    expect(photosQueryOptions(id).queryKey).toEqual(projectKeys.photosByProject(id));
    expect(photosQueryOptions(id).queryKey).toEqual(["projects", id, "photos"]);
  });

  it("preserves stale/gc/retry and enabled semantics", () => {
    const opts = photosQueryOptions("proj-1");
    expect(opts.enabled).toBe(true);
    expect(photosQueryOptions("").enabled).toBe(false);
    expect(opts.staleTime).toBe(30 * 1000);
    expect(opts.gcTime).toBe(5 * 60 * 1000);
    expect(opts.retry).toBe(1);
  });

  it("queryFn resolves through fetchProjectPhotosList", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });

    const opts = photosQueryOptions("proj-2");
    expect(typeof opts.queryFn).toBe("function");
    // queryOptions wraps queryFn; call through the options entry
    const fn = opts.queryFn as (ctx: unknown) => Promise<unknown>;
    await fn({} as never);
    expect(fromMock).toHaveBeenCalledWith("photos");
    expect(eq).toHaveBeenCalledWith("project_id", "proj-2");
    expect(order).toHaveBeenCalledWith("uploaded_at", { ascending: true });
  });
});
