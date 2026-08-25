import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi } from "vitest";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "workflowEvidenceQueryOptions.ts"),
  "utf8",
);

const {
  listRoomAnalysesStrict,
  listRedesignConceptsForClient,
  getLatestScopeAuthorityHeaderStrict,
  getLatestProjectEstimateStrict,
  getLatestExportSnapshotStrict,
} = vi.hoisted(() => ({
  listRoomAnalysesStrict: vi.fn(),
  listRedesignConceptsForClient: vi.fn(),
  getLatestScopeAuthorityHeaderStrict: vi.fn(),
  getLatestProjectEstimateStrict: vi.fn(),
  getLatestExportSnapshotStrict: vi.fn(),
}));

vi.mock("@/features/ai-upload", () => ({
  listRoomAnalysesStrict: (...args: unknown[]) => listRoomAnalysesStrict(...args),
}));

vi.mock("@/features/ai-design", () => ({
  listRedesignConceptsForClient: (...args: unknown[]) => listRedesignConceptsForClient(...args),
}));

vi.mock("@/features/ai-design/infrastructure", () => ({
  getLatestScopeAuthorityHeaderStrict: (...args: unknown[]) =>
    getLatestScopeAuthorityHeaderStrict(...args),
}));

vi.mock("@/features/estimate", () => ({
  getLatestProjectEstimateStrict: (...args: unknown[]) => getLatestProjectEstimateStrict(...args),
}));

vi.mock("@/features/export/infrastructure", () => ({
  getLatestExportSnapshotStrict: (...args: unknown[]) => getLatestExportSnapshotStrict(...args),
}));

import { photosQueryOptions, projectKeys } from "@/lib/queries/projects";
import {
  workflowEvidenceKeys,
  workflowRoomAnalysesQueryOptions,
  workflowRedesignConceptsQueryOptions,
  workflowScopeHeaderQueryOptions,
  workflowProjectEstimateQueryOptions,
  workflowExportSnapshotQueryOptions,
} from "./workflowEvidenceQueryOptions";

describe("workflowEvidenceQueryOptions source contract", () => {
  it("does not own persistence, Supabase, or server-only modules", () => {
    expect(SRC).not.toMatch(/@\/platform\/supabase/);
    expect(SRC).not.toMatch(/\.from\s*\(/);
    expect(SRC).not.toMatch(/room_analyses|scope_analyses|project_export_snapshots/);
    expect(SRC).not.toMatch(/\.server["']/);
    expect(SRC).not.toMatch(/infrastructure\/repositories/);
  });

  it("does not reuse incompatible analysis or room-estimate keys", () => {
    expect(SRC).not.toMatch(/\["photo-analysis"/);
    expect(SRC).not.toMatch(/"photoAnalysis"/);
    expect(workflowEvidenceKeys.roomAnalyses("p1")).not.toEqual(
      projectKeys.photoAnalysisByProject("p1"),
    );
    expect(workflowEvidenceKeys.projectEstimate("p1", "s1")).not.toEqual(
      projectKeys.estimateByProject("p1"),
    );
  });
});

describe("workflow evidence query keys", () => {
  it("uses collision-free workflow keys", () => {
    expect(workflowEvidenceKeys.roomAnalyses("p1")).toEqual([
      "projects",
      "p1",
      "workflow",
      "roomAnalyses",
    ]);
    expect(workflowEvidenceKeys.redesignConcepts("p1")).toEqual([
      "projects",
      "p1",
      "workflow",
      "redesignConcepts",
    ]);
    expect(workflowEvidenceKeys.scopeHeader("p1")).toEqual([
      "projects",
      "p1",
      "workflow",
      "scopeHeader",
    ]);
    expect(workflowEvidenceKeys.exportSnapshot("p1")).toEqual([
      "projects",
      "p1",
      "workflow",
      "exportSnapshot",
    ]);
  });

  it("includes derived scope identity in the estimate key", () => {
    expect(workflowEvidenceKeys.projectEstimate("p1", "scope-9")).toEqual([
      "projects",
      "p1",
      "workflow",
      "projectEstimate",
      "scope-9",
    ]);
    expect(workflowEvidenceKeys.projectEstimate("p1", null)).toEqual([
      "projects",
      "p1",
      "workflow",
      "projectEstimate",
      "no-scope",
    ]);
    expect(workflowEvidenceKeys.projectEstimate("p1")).toEqual([
      "projects",
      "p1",
      "workflow",
      "projectEstimate",
      "no-scope",
    ]);
    expect(workflowEvidenceKeys.projectEstimate("p1", "scope-9")).not.toEqual(
      workflowEvidenceKeys.projectEstimate("p1", null),
    );
  });

  it("keeps photos on the existing photosQueryOptions factory and key", () => {
    const opts = photosQueryOptions("p1");
    expect(opts.queryKey).toEqual(["projects", "p1", "photos"]);
    expect(opts.queryKey).toEqual(projectKeys.photosByProject("p1"));
    expect(SRC).not.toMatch(/workflowPhotos/);
    expect(SRC).not.toMatch(/fetchProjectPhotosList/);
  });
});

describe("workflow evidence queryFns", () => {
  it("room analyses call listRoomAnalysesStrict", async () => {
    listRoomAnalysesStrict.mockResolvedValue([]);
    const opts = workflowRoomAnalysesQueryOptions("p1");
    expect(opts.queryKey).toEqual(workflowEvidenceKeys.roomAnalyses("p1"));
    await opts.queryFn!({} as never);
    expect(listRoomAnalysesStrict).toHaveBeenCalledWith("p1");
  });

  it("redesign concepts call listRedesignConceptsForClient", async () => {
    listRedesignConceptsForClient.mockResolvedValue([]);
    const opts = workflowRedesignConceptsQueryOptions("p1");
    expect(opts.queryKey).toEqual(workflowEvidenceKeys.redesignConcepts("p1"));
    await opts.queryFn!({} as never);
    expect(listRedesignConceptsForClient).toHaveBeenCalledWith("p1");
  });

  it("scope header calls getLatestScopeAuthorityHeaderStrict", async () => {
    getLatestScopeAuthorityHeaderStrict.mockResolvedValue(null);
    const opts = workflowScopeHeaderQueryOptions("p1");
    await opts.queryFn!({} as never);
    expect(getLatestScopeAuthorityHeaderStrict).toHaveBeenCalledWith("p1");
  });

  it("estimate queryFn passes the same currentScopeId used in the key", async () => {
    getLatestProjectEstimateStrict.mockResolvedValue(null);
    const withScope = workflowProjectEstimateQueryOptions("p1", "scope-9");
    expect(withScope.queryKey).toEqual(workflowEvidenceKeys.projectEstimate("p1", "scope-9"));
    await withScope.queryFn!({} as never);
    expect(getLatestProjectEstimateStrict).toHaveBeenCalledWith("p1", "scope-9");

    getLatestProjectEstimateStrict.mockClear();
    const noScope = workflowProjectEstimateQueryOptions("p1", null);
    expect(noScope.queryKey[4]).toBe("no-scope");
    await noScope.queryFn!({} as never);
    expect(getLatestProjectEstimateStrict).toHaveBeenCalledWith("p1", null);
  });

  it("export snapshot calls getLatestExportSnapshotStrict", async () => {
    getLatestExportSnapshotStrict.mockResolvedValue(null);
    const opts = workflowExportSnapshotQueryOptions("p1");
    await opts.queryFn!({} as never);
    expect(getLatestExportSnapshotStrict).toHaveBeenCalledWith("p1");
  });
});
