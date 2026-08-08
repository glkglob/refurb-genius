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
