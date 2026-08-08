/**
 * IA-6-R1 — Transient operation registry unit tests.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  beginProjectWorkflowOperation,
  endProjectWorkflowOperation,
  getProjectWorkflowOperationFlags,
  resetProjectWorkflowOperationRegistryForTests,
  setProjectWorkflowOperationRunning,
  subscribeProjectWorkflowOperations,
  withProjectWorkflowOperationRunning,
} from "./projectWorkflowOperationRegistry";
import { composeProjectWorkflowState } from "../domain/composeProjectWorkflowState";
import { resolveProjectNextAction } from "../domain/resolveProjectNextAction";

const PID = "proj-r1";

beforeEach(() => {
  resetProjectWorkflowOperationRegistryForTests();
});

describe("projectWorkflowOperationRegistry", () => {
  it("defaults all stages to not running", () => {
    expect(getProjectWorkflowOperationFlags(PID)).toEqual({
      photosOperationRunning: false,
      analysisOperationRunning: false,
      redesignOperationRunning: false,
      scopeOperationRunning: false,
      estimateOperationRunning: false,
      exportOperationRunning: false,
    });
  });

  it("set absolute running and clear", () => {
    setProjectWorkflowOperationRunning(PID, "analysis", true);
    expect(getProjectWorkflowOperationFlags(PID).analysisOperationRunning).toBe(true);
    setProjectWorkflowOperationRunning(PID, "analysis", false);
    expect(getProjectWorkflowOperationFlags(PID).analysisOperationRunning).toBe(false);
  });

  it("refcounts concurrent begin/end", () => {
    beginProjectWorkflowOperation(PID, "redesign");
    beginProjectWorkflowOperation(PID, "redesign");
    expect(getProjectWorkflowOperationFlags(PID).redesignOperationRunning).toBe(true);
    endProjectWorkflowOperation(PID, "redesign");
    expect(getProjectWorkflowOperationFlags(PID).redesignOperationRunning).toBe(true);
    endProjectWorkflowOperation(PID, "redesign");
    expect(getProjectWorkflowOperationFlags(PID).redesignOperationRunning).toBe(false);
  });

  it("withProjectWorkflowOperationRunning clears on success and failure", async () => {
    await withProjectWorkflowOperationRunning(PID, "analysis", async () => {
      expect(getProjectWorkflowOperationFlags(PID).analysisOperationRunning).toBe(true);
      return 1;
    });
    expect(getProjectWorkflowOperationFlags(PID).analysisOperationRunning).toBe(false);

    await expect(
      withProjectWorkflowOperationRunning(PID, "analysis", async () => {
        expect(getProjectWorkflowOperationFlags(PID).analysisOperationRunning).toBe(true);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(getProjectWorkflowOperationFlags(PID).analysisOperationRunning).toBe(false);
  });

  it("notifies subscribers on change", () => {
    let n = 0;
    const unsub = subscribeProjectWorkflowOperations(PID, () => {
      n += 1;
    });
    setProjectWorkflowOperationRunning(PID, "photos", true);
    setProjectWorkflowOperationRunning(PID, "photos", false);
    unsub();
    setProjectWorkflowOperationRunning(PID, "photos", true);
    expect(n).toBe(2);
  });
});

describe("IA-6-R1 composition + resolver with operation flags", () => {
  const photoId = "photo-1";

  it("analysis running → view_stage_progress", () => {
    const workflow = composeProjectWorkflowState({
      photos: [{ id: photoId }],
      analyses: [],
      redesignCandidates: [],
      scope: null,
      estimate: null,
      exportSnapshot: null,
      analysisOperationRunning: true,
    });
    expect(workflow.analysis.currency).toBe("running");
    const next = resolveProjectNextAction({ projectId: PID, workflow });
    expect(next.actionKind).toBe("view_stage_progress");
    expect(next.stage).toBe("analysis");
    expect(next.route).toBe(`/projects/${PID}/analysis`);
    expect(next.label).toMatch(/Progress|Analysis/i);
  });

  it("redesign running → view_stage_progress", () => {
    const workflow = composeProjectWorkflowState({
      photos: [{ id: photoId }],
      analyses: [{ photoId, source: "ai" }],
      redesignCandidates: [],
      scope: null,
      estimate: null,
      exportSnapshot: null,
      redesignOperationRunning: true,
    });
    expect(workflow.redesign.currency).toBe("running");
    const next = resolveProjectNextAction({ projectId: PID, workflow });
    expect(next.actionKind).toBe("view_stage_progress");
    expect(next.stage).toBe("redesign");
    expect(next.route).toBe(`/projects/${PID}/redesign`);
  });

  it("loading/absent without operation running is not view_stage_progress", () => {
    const workflow = composeProjectWorkflowState({
      photos: [{ id: photoId }],
      analyses: [],
      redesignCandidates: [],
      scope: null,
      estimate: null,
      exportSnapshot: null,
      // no *OperationRunning
    });
    const next = resolveProjectNextAction({ projectId: PID, workflow });
    expect(next.actionKind).toBe("analyse_photos");
    expect(next.actionKind).not.toBe("view_stage_progress");
  });

  it("earlier stale Analysis beats later redesign running", () => {
    const workflow = composeProjectWorkflowState({
      photos: [{ id: photoId }, { id: "photo-2" }],
      // analyses cover only one photo → non_current
      analyses: [{ photoId, source: "ai" }],
      redesignCandidates: [
        {
          id: "r1",
          style: "modern",
          analysisIdentity: photoId,
          isSelected: true,
        },
      ],
      scope: null,
      estimate: null,
      exportSnapshot: null,
      redesignOperationRunning: true,
    });
    expect(workflow.analysis.currency).toBe("non_current");
    const next = resolveProjectNextAction({ projectId: PID, workflow });
    expect(next.actionKind).toBe("update_analysis");
    expect(next.actionKind).not.toBe("view_stage_progress");
  });

  it("multiple running — earliest required stage wins", () => {
    const workflow = composeProjectWorkflowState({
      photos: [{ id: photoId }],
      analyses: [{ photoId, source: "ai" }],
      redesignCandidates: [],
      scope: null,
      estimate: null,
      exportSnapshot: null,
      analysisOperationRunning: true,
      redesignOperationRunning: true,
    });
    const next = resolveProjectNextAction({ projectId: PID, workflow });
    // Analysis is earlier in journey; both running → analysis first
    expect(next.stage).toBe("analysis");
    expect(next.actionKind).toBe("view_stage_progress");
  });
});
