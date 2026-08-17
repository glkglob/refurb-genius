import { describe, expect, it } from "vitest";
import { composeProjectWorkflowState } from "./composeProjectWorkflowState";
import { resolveProjectNextAction } from "./resolveProjectNextAction";

const photoA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const photoB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("composeProjectWorkflowState + resolver (IA-5)", () => {
  it("reconcile_scope when redesign current and scope absent", () => {
    const workflow = composeProjectWorkflowState({
      photos: [{ id: photoA }],
      analyses: [{ photoId: photoA, source: "ai" }],
      redesignCandidates: [
        {
          id: "r1",
          style: "Modern",
          analysisIdentity: photoA,
          isSelected: true,
        },
      ],
      scope: null,
      estimate: null,
      exportSnapshot: null,
    });
    const next = resolveProjectNextAction({ projectId: "p1", workflow });
    expect(next.actionKind).toBe("reconcile_scope");
    expect(next.stage).toBe("estimate");
    expect(next.route).toBe("/projects/p1/estimate");
    expect(next.label).toBe("Review Scope");
  });

  it("build_estimate when scope current and estimate absent", () => {
    const workflow = composeProjectWorkflowState({
      photos: [{ id: photoA }],
      analyses: [{ photoId: photoA, source: "ai" }],
      redesignCandidates: [
        { id: "r1", style: "Modern", analysisIdentity: photoA, isSelected: true },
      ],
      scope: {
        id: "s1",
        analysisIdentity: photoA,
        redesignIdentity: "r1",
      },
      estimate: null,
      exportSnapshot: null,
    });
    const next = resolveProjectNextAction({ projectId: "p1", workflow });
    expect(next.actionKind).toBe("build_estimate");
    expect(next.stage).toBe("estimate");
  });

  it("update_estimate when scope advanced", () => {
    const workflow = composeProjectWorkflowState({
      photos: [{ id: photoA }],
      analyses: [{ photoId: photoA, source: "ai" }],
      redesignCandidates: [
        { id: "r1", style: "Modern", analysisIdentity: photoA, isSelected: true },
      ],
      scope: {
        id: "s2",
        analysisIdentity: photoA,
        redesignIdentity: "r1",
      },
      estimate: { id: "e1", inputScopeId: "s1" },
      exportSnapshot: null,
    });
    const next = resolveProjectNextAction({ projectId: "p1", workflow });
    expect(next.actionKind).toBe("update_estimate");
  });

  it("create_export when estimate current and no snapshot", () => {
    const workflow = composeProjectWorkflowState({
      photos: [{ id: photoA }],
      analyses: [{ photoId: photoA, source: "ai" }],
      redesignCandidates: [
        { id: "r1", style: "Modern", analysisIdentity: photoA, isSelected: true },
      ],
      scope: {
        id: "s1",
        analysisIdentity: photoA,
        redesignIdentity: "r1",
      },
      estimate: { id: "e1", inputScopeId: "s1" },
      exportSnapshot: null,
    });
    const next = resolveProjectNextAction({ projectId: "p1", workflow });
    expect(next.actionKind).toBe("create_export");
    expect(next.route).toBe("/projects/p1/report");
  });

  it("redesign change makes scope non_current → reconcile_scope", () => {
    const workflow = composeProjectWorkflowState({
      photos: [{ id: photoA }],
      analyses: [{ photoId: photoA, source: "ai" }],
      redesignCandidates: [
        { id: "r2", style: "Modern", analysisIdentity: photoA, isSelected: true },
      ],
      scope: {
        id: "s1",
        analysisIdentity: photoA,
        redesignIdentity: "r1",
      },
      estimate: { id: "e1", inputScopeId: "s1" },
      exportSnapshot: { id: "x1", estimateId: "e1" },
    });
    const next = resolveProjectNextAction({ projectId: "p1", workflow });
    expect(next.actionKind).toBe("reconcile_scope");
    expect(workflow.scope.currency).toBe("non_current");
  });

  it("photo/analysis change wins over downstream", () => {
    const identityA = photoA;
    const identityB = [photoA, photoB].sort().join("\u0001");
    const workflow = composeProjectWorkflowState({
      photos: [{ id: photoA }, { id: photoB }],
      analyses: [{ photoId: photoA, source: "ai" }], // incomplete coverage → non_current
      redesignCandidates: [
        { id: "r1", style: "Modern", analysisIdentity: identityA, isSelected: true },
      ],
      scope: {
        id: "s1",
        analysisIdentity: identityA,
        redesignIdentity: "r1",
      },
      estimate: { id: "e1", inputScopeId: "s1" },
      exportSnapshot: { id: "x1", estimateId: "e1" },
    });
    expect(workflow.analysis.currency).toBe("non_current");
    const next = resolveProjectNextAction({ projectId: "p1", workflow });
    expect(next.actionKind).toBe("update_analysis");
    void identityB;
  });

  it("completed project when all current", () => {
    const workflow = composeProjectWorkflowState({
      photos: [{ id: photoA }],
      analyses: [{ photoId: photoA, source: "ai" }],
      redesignCandidates: [
        { id: "r1", style: "Modern", analysisIdentity: photoA, isSelected: true },
      ],
      scope: {
        id: "s1",
        analysisIdentity: photoA,
        redesignIdentity: "r1",
      },
      estimate: { id: "e1", inputScopeId: "s1" },
      exportSnapshot: { id: "x1", estimateId: "e1" },
    });
    const next = resolveProjectNextAction({ projectId: "p1", workflow });
    expect(next.actionKind).toBe("view_completed_project");
    expect(next.status).toBe("Complete");
  });

  it("never routes primary continuation to /scope", () => {
    const workflow = composeProjectWorkflowState({
      photos: [{ id: photoA }],
      analyses: [{ photoId: photoA, source: "ai" }],
      redesignCandidates: [
        { id: "r1", style: "Modern", analysisIdentity: photoA, isSelected: true },
      ],
      scope: null,
      estimate: null,
      exportSnapshot: null,
    });
    const next = resolveProjectNextAction({ projectId: "p1", workflow });
    expect(next.route).not.toMatch(/\/scope$/);
    expect(next.route).toContain("/estimate");
  });
});

const PHOTO_DELETED = "937a24a4-855e-4bb7-8627-fc8470dac3dd";
const PHOTO_1 = "d04cad1d-69fa-46bd-8431-136ee1f20f3c";
const PHOTO_2 = "d7b2c46a-379a-45a4-bd65-e21940ed7543";
const PHOTO_3 = "fdc70554-bbf9-432a-8887-5e14d125a5d4";
const IDENTITY_A = [PHOTO_DELETED, PHOTO_1, PHOTO_2, PHOTO_3].sort().join("\u0001");
const IDENTITY_B = [PHOTO_1, PHOTO_2, PHOTO_3].sort().join("\u0001");

describe("composeProjectWorkflowState Redesign currentness (T24–T28)", () => {
  const fourPhotos = [{ id: PHOTO_DELETED }, { id: PHOTO_1 }, { id: PHOTO_2 }, { id: PHOTO_3 }];
  const threePhotos = [{ id: PHOTO_1 }, { id: PHOTO_2 }, { id: PHOTO_3 }];
  const analysesA = fourPhotos.map((p) => ({ photoId: p.id, source: "ai" as const }));
  const analysesB = threePhotos.map((p) => ({ photoId: p.id, source: "ai" as const }));
  const conceptsA = [{ id: "rA", style: "Modern", analysisIdentity: IDENTITY_A, isSelected: true }];

  it("T24: four-photo current Analysis + selected A is Redesign current", () => {
    const workflow = composeProjectWorkflowState({
      photos: fourPhotos,
      analyses: analysesA,
      redesignCandidates: conceptsA,
      scope: null,
      estimate: null,
      exportSnapshot: null,
    });
    expect(workflow.analysis.currency).toBe("current");
    expect(workflow.redesign.currency).toBe("current");
  });

  it("T25: deleting one photo makes Analysis and Redesign non-current; Scope ignores stale selected", () => {
    const workflow = composeProjectWorkflowState({
      photos: threePhotos,
      analyses: [...analysesB, { photoId: null, source: "ai" }],
      redesignCandidates: conceptsA,
      scope: {
        id: "s1",
        analysisIdentity: IDENTITY_A,
        redesignIdentity: "rA",
      },
      estimate: null,
      exportSnapshot: null,
    });
    expect(workflow.analysis.currency).toBe("non_current");
    expect(workflow.redesign.currency).not.toBe("current");
    expect(workflow.scope.currency).not.toBe("current");
    const next = resolveProjectNextAction({ projectId: "p1", workflow });
    expect(next.actionKind).toBe("update_analysis");
  });

  it("T26: Analysis B with only A concepts is Redesign absent, not Complete", () => {
    const workflow = composeProjectWorkflowState({
      photos: threePhotos,
      analyses: analysesB,
      redesignCandidates: conceptsA,
      scope: null,
      estimate: null,
      exportSnapshot: null,
    });
    expect(workflow.analysis.currency).toBe("current");
    expect(workflow.redesign.currency).toBe("absent");
    const next = resolveProjectNextAction({ projectId: "p1", workflow });
    expect(next.actionKind).toBe("create_redesign");
  });

  it("T27: Analysis B + selected B is Redesign current", () => {
    const workflow = composeProjectWorkflowState({
      photos: threePhotos,
      analyses: analysesB,
      redesignCandidates: [
        ...conceptsA,
        { id: "rB", style: "Modern", analysisIdentity: IDENTITY_B, isSelected: true },
      ],
      scope: null,
      estimate: null,
      exportSnapshot: null,
    });
    expect(workflow.redesign.currency).toBe("current");
    const next = resolveProjectNextAction({ projectId: "p1", workflow });
    expect(next.actionKind).toBe("reconcile_scope");
  });

  it("T28: raw isSelected on A is ignored for currentSelectedRedesignIdentity", () => {
    const workflow = composeProjectWorkflowState({
      photos: threePhotos,
      analyses: analysesB,
      redesignCandidates: conceptsA,
      scope: {
        id: "s1",
        analysisIdentity: IDENTITY_B,
        redesignIdentity: "rA",
      },
      estimate: null,
      exportSnapshot: null,
    });
    expect(workflow.redesign.currency).toBe("absent");
    expect(workflow.scope.currency).not.toBe("current");
  });
});
