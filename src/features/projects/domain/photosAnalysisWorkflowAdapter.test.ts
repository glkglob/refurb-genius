/**
 * IA-3 — Photos/Analysis workflow-state adapter + resolver integration.
 */
import { describe, expect, it } from "vitest";
import {
  analysisCurrencyFromEvidence,
  buildPhotosAnalysisWorkflowState,
  photosCurrencyFromEvidence,
} from "./photosAnalysisWorkflowAdapter";
import { resolveProjectNextAction } from "./resolveProjectNextAction";

const PROJECT_ID = "proj-ia3";

describe("IA-3 photosCurrencyFromEvidence", () => {
  it("no durable photos → absent", () => {
    expect(photosCurrencyFromEvidence({ photos: [] })).toEqual({
      currency: "absent",
      photoCount: 0,
    });
  });

  it("durable photos → current", () => {
    expect(photosCurrencyFromEvidence({ photos: [{ id: "p1" }] }).currency).toBe("current");
  });

  it("running mutation → running", () => {
    expect(
      photosCurrencyFromEvidence({
        photos: [{ id: "p1" }],
        photosOperationRunning: true,
      }).currency,
    ).toBe("running");
  });
});

describe("IA-3 analysisCurrencyFromEvidence", () => {
  it("current photos + no analyses → absent", () => {
    expect(
      analysisCurrencyFromEvidence({
        photos: [{ id: "p1" }],
        analyses: [],
      }).currency,
    ).toBe("absent");
  });

  it("exact photo_id coverage + ai source → current", () => {
    expect(
      analysisCurrencyFromEvidence({
        photos: [{ id: "p1" }, { id: "p2" }],
        analyses: [
          { photoId: "p1", source: "ai" },
          { photoId: "p2", source: "fallback" },
        ],
      }).currency,
    ).toBe("current");
  });

  it("mock analyses → non_current (never current)", () => {
    expect(
      analysisCurrencyFromEvidence({
        photos: [{ id: "p1" }],
        analyses: [{ photoId: "p1", source: "mock" }],
      }).currency,
    ).toBe("non_current");
  });

  it("catalogue add after analysis → non_current", () => {
    expect(
      analysisCurrencyFromEvidence({
        photos: [{ id: "p1" }, { id: "p2" }],
        analyses: [{ photoId: "p1", source: "ai" }],
      }).currency,
    ).toBe("non_current");
  });

  it("catalogue remove after analysis → non_current", () => {
    expect(
      analysisCurrencyFromEvidence({
        photos: [{ id: "p1" }],
        analyses: [
          { photoId: "p1", source: "ai" },
          { photoId: "p2", source: "ai" },
        ],
      }).currency,
    ).toBe("non_current");
  });

  it("analysis running → running", () => {
    expect(
      analysisCurrencyFromEvidence({
        photos: [{ id: "p1" }],
        analyses: [],
        analysisOperationRunning: true,
      }).currency,
    ).toBe("running");
  });

  it("legacy done-style rows without photo_id → non_current", () => {
    expect(
      analysisCurrencyFromEvidence({
        photos: [{ id: "p1" }],
        analyses: [{ photoId: null, source: "ai" }],
      }).currency,
    ).toBe("non_current");
  });
});

describe("IA-3 adapter → resolveProjectNextAction integration", () => {
  it("no photos → add_photos", () => {
    const workflow = buildPhotosAnalysisWorkflowState({
      photos: [],
      analyses: [],
    });
    const next = resolveProjectNextAction({ projectId: PROJECT_ID, workflow });
    expect(next).toMatchObject({
      stage: "photos",
      status: "Ready",
      actionKind: "add_photos",
      route: `/projects/${PROJECT_ID}/upload`,
    });
  });

  it("current photos + no Analysis → analyse_photos", () => {
    const workflow = buildPhotosAnalysisWorkflowState({
      photos: [{ id: "p1" }],
      analyses: [],
    });
    const next = resolveProjectNextAction({ projectId: PROJECT_ID, workflow });
    expect(next).toMatchObject({
      stage: "analysis",
      status: "Ready",
      actionKind: "analyse_photos",
      route: `/projects/${PROJECT_ID}/analysis`,
    });
  });

  it("Analysis running → view_stage_progress", () => {
    const workflow = buildPhotosAnalysisWorkflowState({
      photos: [{ id: "p1" }],
      analyses: [],
      analysisOperationRunning: true,
    });
    const next = resolveProjectNextAction({ projectId: PROJECT_ID, workflow });
    expect(next).toMatchObject({
      stage: "analysis",
      status: "In progress",
      actionKind: "view_stage_progress",
    });
    expect(next.actionKind).not.toBe("analyse_photos");
  });

  it("stale Analysis after photo add → update_analysis", () => {
    const workflow = buildPhotosAnalysisWorkflowState({
      photos: [{ id: "p1" }, { id: "p2" }],
      analyses: [{ photoId: "p1", source: "ai" }],
    });
    const next = resolveProjectNextAction({ projectId: PROJECT_ID, workflow });
    expect(next).toMatchObject({
      stage: "analysis",
      status: "Needs attention",
      actionKind: "update_analysis",
    });
  });

  it("current Analysis → advances to Redesign (create_redesign), not Estimate", () => {
    const workflow = buildPhotosAnalysisWorkflowState({
      photos: [{ id: "p1" }],
      analyses: [{ photoId: "p1", source: "ai" }],
    });
    const next = resolveProjectNextAction({ projectId: PROJECT_ID, workflow });
    expect(next).toMatchObject({
      stage: "redesign",
      status: "Ready",
      actionKind: "create_redesign",
      route: `/projects/${PROJECT_ID}/analysis?focus=redesign`,
    });
    expect(next.actionKind).not.toBe("build_estimate");
  });

  it("failed mutation does not change currency when photos unchanged", () => {
    // Adapter sees only durable state: failed upload never appears in photos[].
    const before = buildPhotosAnalysisWorkflowState({
      photos: [{ id: "p1" }],
      analyses: [{ photoId: "p1", source: "ai" }],
    });
    const afterFailedUpload = buildPhotosAnalysisWorkflowState({
      photos: [{ id: "p1" }],
      analyses: [{ photoId: "p1", source: "ai" }],
    });
    expect(before).toEqual(afterFailedUpload);
    expect(
      resolveProjectNextAction({ projectId: PROJECT_ID, workflow: afterFailedUpload }).actionKind,
    ).toBe("create_redesign");
  });

  it("photos running wins over ready Analysis", () => {
    const workflow = buildPhotosAnalysisWorkflowState({
      photos: [{ id: "p1" }],
      photosOperationRunning: true,
      analyses: [],
    });
    const next = resolveProjectNextAction({ projectId: PROJECT_ID, workflow });
    expect(next.stage).toBe("photos");
    expect(next.actionKind).toBe("view_stage_progress");
  });
});
