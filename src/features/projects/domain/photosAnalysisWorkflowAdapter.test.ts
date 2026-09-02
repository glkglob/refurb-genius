/**
 * IA-3 — Photos/Analysis workflow-state adapter + resolver integration.
 */
import { describe, expect, it } from "vitest";
import {
  analysisCurrencyFromEvidence,
  analysisShellFlagsFromCurrency,
  buildPhotosAnalysisWorkflowState,
  photosCurrencyFromEvidence,
} from "./photosAnalysisWorkflowAdapter";
import { resolveProjectNextAction } from "./resolveProjectNextAction";
import { buildProjectWorkflowStages } from "./workflowStages";

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

  it("deleting one of four catalogue photos invalidates a four-row analysis set", () => {
    expect(
      analysisCurrencyFromEvidence({
        photos: [{ id: "p2" }, { id: "p3" }, { id: "p4" }],
        analyses: [
          { photoId: "p1", source: "ai" },
          { photoId: "p2", source: "ai" },
          { photoId: "p3", source: "ai" },
          { photoId: "p4", source: "ai" },
        ],
      }).currency,
    ).toBe("non_current");
    expect(analysisShellFlagsFromCurrency("non_current")).toEqual({
      analysisDone: true,
      analysisNeedsAttention: true,
    });
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
      route: `/projects/${PROJECT_ID}/redesign`,
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

describe("IA-3-R1 analysisShellFlagsFromCurrency + shell/resolver consistency", () => {
  function shellAnalysisStatus(
    currency: "current" | "non_current" | "running" | "absent",
    photoCount: number,
  ) {
    const flags = analysisShellFlagsFromCurrency(currency);
    const stages = buildProjectWorkflowStages({
      progress: {
        photosDone: photoCount > 0,
        photoCount,
        analysisDone: flags.analysisDone,
        analysisNeedsAttention: flags.analysisNeedsAttention,
        estimateDone: false,
        reportDone: false,
      },
      route: { surface: "analysis" },
    });
    return stages.find((s) => s.id === "analysis")?.status;
  }

  it("current AI Analysis → shell Complete + create_redesign", () => {
    const workflow = buildPhotosAnalysisWorkflowState({
      photos: [{ id: "p1" }],
      analyses: [{ photoId: "p1", source: "ai" }],
    });
    expect(workflow.analysis.currency).toBe("current");
    expect(analysisShellFlagsFromCurrency("current")).toEqual({
      analysisDone: true,
      analysisNeedsAttention: false,
    });
    expect(shellAnalysisStatus("current", 1)).toBe("Complete");
    const next = resolveProjectNextAction({ projectId: PROJECT_ID, workflow });
    expect(next.actionKind).toBe("create_redesign");
    // Forbidden contradiction: Needs attention + create_redesign
    expect(shellAnalysisStatus("current", 1)).not.toBe("Needs attention");
  });

  it("current fallback Analysis → shell Complete + create_redesign (not Needs attention)", () => {
    const workflow = buildPhotosAnalysisWorkflowState({
      photos: [{ id: "p1" }],
      analyses: [{ photoId: "p1", source: "fallback" }],
    });
    expect(workflow.analysis.currency).toBe("current");
    expect(shellAnalysisStatus("current", 1)).toBe("Complete");
    const next = resolveProjectNextAction({ projectId: PROJECT_ID, workflow });
    expect(next).toMatchObject({
      stage: "redesign",
      actionKind: "create_redesign",
    });
    expect(shellAnalysisStatus("current", 1)).not.toBe("Needs attention");
  });

  it("low-confidence current Analysis still maps to Complete (advisory is separate)", () => {
    // Currency current ⇒ shell Complete; quality review is not a stage status input.
    expect(analysisShellFlagsFromCurrency("current").analysisNeedsAttention).toBe(false);
    expect(shellAnalysisStatus("current", 2)).toBe("Complete");
  });

  it("mock Analysis → non_current → shell Needs attention + never create_redesign", () => {
    const workflow = buildPhotosAnalysisWorkflowState({
      photos: [{ id: "p1" }],
      analyses: [{ photoId: "p1", source: "mock" }],
    });
    expect(workflow.analysis.currency).toBe("non_current");
    expect(analysisShellFlagsFromCurrency("non_current")).toEqual({
      analysisDone: true,
      analysisNeedsAttention: true,
    });
    expect(shellAnalysisStatus("non_current", 1)).toBe("Needs attention");
    const next = resolveProjectNextAction({ projectId: PROJECT_ID, workflow });
    expect(next.actionKind).toBe("update_analysis");
    expect(next.actionKind).not.toBe("create_redesign");
  });

  it("catalogue mismatch → Needs attention + update_analysis", () => {
    const workflow = buildPhotosAnalysisWorkflowState({
      photos: [{ id: "p1" }, { id: "p2" }],
      analyses: [{ photoId: "p1", source: "ai" }],
    });
    expect(workflow.analysis.currency).toBe("non_current");
    expect(shellAnalysisStatus("non_current", 2)).toBe("Needs attention");
    expect(resolveProjectNextAction({ projectId: PROJECT_ID, workflow }).actionKind).toBe(
      "update_analysis",
    );
  });

  it("photo added after current Analysis → Needs attention + update_analysis", () => {
    const workflow = buildPhotosAnalysisWorkflowState({
      photos: [{ id: "p1" }, { id: "p2" }],
      analyses: [{ photoId: "p1", source: "fallback" }],
    });
    expect(shellAnalysisStatus("non_current", 2)).toBe("Needs attention");
    expect(resolveProjectNextAction({ projectId: PROJECT_ID, workflow }).actionKind).toBe(
      "update_analysis",
    );
  });

  it("photo removed after current Analysis → Needs attention + update_analysis", () => {
    const workflow = buildPhotosAnalysisWorkflowState({
      photos: [{ id: "p1" }],
      analyses: [
        { photoId: "p1", source: "ai" },
        { photoId: "p2", source: "ai" },
      ],
    });
    expect(shellAnalysisStatus("non_current", 1)).toBe("Needs attention");
    expect(resolveProjectNextAction({ projectId: PROJECT_ID, workflow }).actionKind).toBe(
      "update_analysis",
    );
  });

  it("impossible: shell Needs attention while resolver create_redesign for same currency", () => {
    for (const currency of ["current", "non_current", "running", "absent"] as const) {
      const flags = analysisShellFlagsFromCurrency(currency);
      // Synthetic workflow states for each currency
      const workflow =
        currency === "current"
          ? buildPhotosAnalysisWorkflowState({
              photos: [{ id: "p1" }],
              analyses: [{ photoId: "p1", source: "fallback" }],
            })
          : currency === "non_current"
            ? buildPhotosAnalysisWorkflowState({
                photos: [{ id: "p1" }, { id: "p2" }],
                analyses: [{ photoId: "p1", source: "ai" }],
              })
            : currency === "running"
              ? buildPhotosAnalysisWorkflowState({
                  photos: [{ id: "p1" }],
                  analyses: [],
                  analysisOperationRunning: true,
                })
              : buildPhotosAnalysisWorkflowState({
                  photos: [{ id: "p1" }],
                  analyses: [],
                });

      const next = resolveProjectNextAction({ projectId: PROJECT_ID, workflow });
      const shellStatus = shellAnalysisStatus(currency, 1);
      if (next.actionKind === "create_redesign") {
        expect(flags.analysisNeedsAttention).toBe(false);
        expect(shellStatus).not.toBe("Needs attention");
      }
      if (shellStatus === "Needs attention") {
        expect(next.actionKind).toBe("update_analysis");
        expect(next.actionKind).not.toBe("create_redesign");
      }
    }
  });
});
