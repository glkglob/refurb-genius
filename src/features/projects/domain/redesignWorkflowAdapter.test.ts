/**
 * IA-4 — Redesign workflow-state adapter + resolver integration.
 */
import { describe, expect, it } from "vitest";
import {
  redesignCurrencyFromEvidence,
  redesignShellFlagsFromCurrency,
} from "./redesignWorkflowAdapter";
import { buildPhotosAnalysisWorkflowState } from "./photosAnalysisWorkflowAdapter";
import { resolveProjectNextAction } from "./resolveProjectNextAction";
import { buildProjectWorkflowStages } from "./workflowStages";

const PROJECT_ID = "proj-ia4";
const ID_A = "photo-a\u0001photo-b";
const ID_B = "photo-a\u0001photo-c";

describe("IA-4 redesignCurrencyFromEvidence", () => {
  it("current Analysis + no candidates → absent (create)", () => {
    expect(
      redesignCurrencyFromEvidence({
        analysisCurrency: "current",
        currentAnalysisIdentity: ID_A,
        candidates: [],
      }),
    ).toEqual({ currency: "absent", hasUnselectedCandidates: false });
  });

  it("candidates without selection → absent + hasUnselectedCandidates", () => {
    expect(
      redesignCurrencyFromEvidence({
        analysisCurrency: "current",
        currentAnalysisIdentity: ID_A,
        candidates: [{ id: "c1", style: "Modern", analysisIdentity: ID_A, isSelected: false }],
      }),
    ).toEqual({ currency: "absent", hasUnselectedCandidates: true });
  });

  it("selected matching Analysis identity → current", () => {
    expect(
      redesignCurrencyFromEvidence({
        analysisCurrency: "current",
        currentAnalysisIdentity: ID_A,
        candidates: [
          { id: "c1", style: "Modern", analysisIdentity: ID_A, isSelected: true },
          { id: "c2", style: "Luxury", analysisIdentity: ID_A, isSelected: false },
        ],
      }).currency,
    ).toBe("current");
  });

  it("T17: selected against older Analysis is absent, not Complete", () => {
    const state = redesignCurrencyFromEvidence({
      analysisCurrency: "current",
      currentAnalysisIdentity: ID_B,
      candidates: [{ id: "c1", style: "Modern", analysisIdentity: ID_A, isSelected: true }],
    });
    expect(state).toEqual({ currency: "absent", hasUnselectedCandidates: false });
    expect(redesignShellFlagsFromCurrency(state.currency).redesignDone).toBe(false);
  });

  it("T18: current unselected candidates ignore historical selected", () => {
    const state = redesignCurrencyFromEvidence({
      analysisCurrency: "current",
      currentAnalysisIdentity: ID_B,
      candidates: [
        { id: "c-old", style: "Modern", analysisIdentity: ID_A, isSelected: true },
        { id: "c-new", style: "Luxury", analysisIdentity: ID_B, isSelected: false },
      ],
    });
    expect(state).toEqual({ currency: "absent", hasUnselectedCandidates: true });
    expect(redesignShellFlagsFromCurrency(state.currency).redesignDone).toBe(false);
  });

  it("T19: non-current Analysis + historical selected is absent", () => {
    expect(
      redesignCurrencyFromEvidence({
        analysisCurrency: "non_current",
        currentAnalysisIdentity: ID_A,
        candidates: [{ id: "c1", style: "Modern", analysisIdentity: ID_A, isSelected: true }],
      }),
    ).toEqual({ currency: "absent" });
  });

  it("T22: hasUnselectedCandidates ignores historical-only rows", () => {
    expect(
      redesignCurrencyFromEvidence({
        analysisCurrency: "current",
        currentAnalysisIdentity: ID_B,
        candidates: [
          { id: "c1", style: "Modern", analysisIdentity: ID_A, isSelected: false },
          { id: "c2", style: "Luxury", analysisIdentity: ID_A, isSelected: true },
        ],
      }).hasUnselectedCandidates,
    ).toBe(false);
  });

  it("generation alone (no selection) is not Complete", () => {
    const state = redesignCurrencyFromEvidence({
      analysisCurrency: "current",
      currentAnalysisIdentity: ID_A,
      candidates: [
        { id: "c1", style: "Modern", analysisIdentity: ID_A, isSelected: false },
        { id: "c2", style: "Luxury", analysisIdentity: ID_A, isSelected: false },
      ],
    });
    expect(state.currency).toBe("absent");
    expect(state.hasUnselectedCandidates).toBe(true);
    expect(redesignShellFlagsFromCurrency(state.currency).redesignDone).toBe(false);
  });

  it("first candidate is not implicitly selected", () => {
    const state = redesignCurrencyFromEvidence({
      analysisCurrency: "current",
      currentAnalysisIdentity: ID_A,
      candidates: [{ id: "c0", style: "Modern", analysisIdentity: ID_A, isSelected: false }],
    });
    expect(state.currency).not.toBe("current");
  });

  it("running → running", () => {
    expect(
      redesignCurrencyFromEvidence({
        analysisCurrency: "current",
        currentAnalysisIdentity: ID_A,
        candidates: [],
        redesignOperationRunning: true,
      }).currency,
    ).toBe("running");
  });

  it("mock/non-current Analysis blocks Redesign current", () => {
    expect(
      redesignCurrencyFromEvidence({
        analysisCurrency: "non_current",
        currentAnalysisIdentity: ID_A,
        candidates: [{ id: "c1", style: "Modern", analysisIdentity: ID_A, isSelected: true }],
      }).currency,
    ).not.toBe("current");
  });
});

describe("IA-4 adapter → resolveProjectNextAction", () => {
  function next(redesign: ReturnType<typeof redesignCurrencyFromEvidence>) {
    const base = buildPhotosAnalysisWorkflowState({
      photos: [{ id: "p1" }],
      analyses: [{ photoId: "p1", source: "ai" }],
    });
    return resolveProjectNextAction({
      projectId: PROJECT_ID,
      workflow: { ...base, redesign },
    });
  }

  it("current Analysis + no candidates → create_redesign at /redesign", () => {
    const n = next({ currency: "absent", hasUnselectedCandidates: false });
    expect(n).toMatchObject({
      stage: "redesign",
      actionKind: "create_redesign",
      route: `/projects/${PROJECT_ID}/redesign`,
    });
  });

  it("candidates unselected → select_redesign", () => {
    const n = next({ currency: "absent", hasUnselectedCandidates: true });
    expect(n.actionKind).toBe("select_redesign");
    expect(n.route).toBe(`/projects/${PROJECT_ID}/redesign`);
  });

  it("selected current → advances past redesign (not stuck)", () => {
    const n = next({ currency: "current" });
    expect(n.stage).not.toBe("redesign");
    expect(n.actionKind).not.toBe("create_redesign");
  });

  it("T21: stale selected mapping produces create_redesign, not update_redesign", () => {
    const redesign = redesignCurrencyFromEvidence({
      analysisCurrency: "current",
      currentAnalysisIdentity: ID_B,
      candidates: [{ id: "c1", style: "Modern", analysisIdentity: ID_A, isSelected: true }],
    });
    expect(redesign.currency).toBe("absent");
    const n = next(redesign);
    expect(n).toMatchObject({
      stage: "redesign",
      actionKind: "create_redesign",
      route: `/projects/${PROJECT_ID}/redesign`,
    });
  });

  it("resolver still maps emitted non_current to update_redesign", () => {
    const n = next({ currency: "non_current" });
    expect(n).toMatchObject({
      stage: "redesign",
      status: "Needs attention",
      actionKind: "update_redesign",
      route: `/projects/${PROJECT_ID}/redesign`,
    });
  });

  it("running → view_stage_progress", () => {
    const n = next({ currency: "running" });
    expect(n).toMatchObject({
      stage: "redesign",
      status: "In progress",
      actionKind: "view_stage_progress",
    });
  });

  it("gated Redesign → unlock_redesign", () => {
    const base = buildPhotosAnalysisWorkflowState({
      photos: [{ id: "p1" }],
      analyses: [{ photoId: "p1", source: "ai" }],
    });
    const n = resolveProjectNextAction({
      projectId: PROJECT_ID,
      workflow: { ...base, redesign: { currency: "absent" } },
      entitlements: { redesignAllowed: false, redesignRequirement: "redesign" },
    });
    expect(n.actionKind).toBe("unlock_redesign");
    expect(n.route).toBe(`/projects/${PROJECT_ID}/redesign`);
  });
});

describe("IA-4 shell flags", () => {
  it("current → Complete shell status", () => {
    const flags = redesignShellFlagsFromCurrency("current");
    const stages = buildProjectWorkflowStages({
      progress: {
        photosDone: true,
        analysisDone: true,
        redesignDone: flags.redesignDone,
        redesignNeedsAttention: flags.redesignNeedsAttention,
        estimateDone: false,
        reportDone: false,
        photoCount: 1,
      },
      route: { surface: "redesign" },
    });
    expect(stages.find((s) => s.id === "redesign")?.status).toBe("Complete");
  });

  it("T23: only current sets redesignDone", () => {
    expect(redesignShellFlagsFromCurrency("current")).toEqual({
      redesignDone: true,
      redesignNeedsAttention: false,
    });
    expect(redesignShellFlagsFromCurrency("non_current")).toEqual({
      redesignDone: false,
      redesignNeedsAttention: true,
    });
    expect(redesignShellFlagsFromCurrency("absent")).toEqual({
      redesignDone: false,
      redesignNeedsAttention: false,
    });
  });
});
