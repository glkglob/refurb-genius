import { describe, expect, it } from "vitest";
import {
  PROJECT_OVERVIEW_IS_WORKFLOW_STAGE,
  PROJECT_WORKFLOW_STAGE_IDS,
  PROJECT_WORKFLOW_STAGES,
  PROJECT_WORKFLOW_STATUS_LABELS,
  buildProjectIdentitySubtitle,
  buildProjectIdentityTitle,
  buildProjectWorkflowStages,
  isCanonicalWorkflowStatus,
  resolveActiveWorkflowStage,
  stageDestination,
} from "./workflowStages";

describe("IA-1 canonical five-stage presentation model", () => {
  it("orders stages exactly Photos → Analysis → Redesign → Estimate → Export", () => {
    expect(PROJECT_WORKFLOW_STAGE_IDS).toEqual([
      "photos",
      "analysis",
      "redesign",
      "estimate",
      "export",
    ]);
    expect(PROJECT_WORKFLOW_STAGES.map((s) => s.label)).toEqual([
      "Photos",
      "Analysis",
      "Redesign",
      "Estimate",
      "Export",
    ]);
    expect(PROJECT_WORKFLOW_STAGES.map((s) => s.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("does not treat Overview as a workflow stage", () => {
    expect(PROJECT_OVERVIEW_IS_WORKFLOW_STAGE).toBe(false);
    expect(resolveActiveWorkflowStage({ surface: "overview" })).toBeNull();
    expect(PROJECT_WORKFLOW_STAGE_IDS).not.toContain("overview");
  });

  it("maps Photos to the upload surface", () => {
    expect(stageDestination("photos")).toEqual({
      kind: "route",
      to: "/projects/$id/upload",
    });
    expect(resolveActiveWorkflowStage({ surface: "upload" })).toBe("photos");
  });

  it("maps Analysis to the analysis surface", () => {
    expect(stageDestination("analysis")).toEqual({
      kind: "route",
      to: "/projects/$id/analysis",
    });
    expect(resolveActiveWorkflowStage({ surface: "analysis" })).toBe("analysis");
  });

  it("maps Estimate correctly (including scope as estimate-family)", () => {
    expect(stageDestination("estimate")).toEqual({
      kind: "route",
      to: "/projects/$id/estimate",
    });
    expect(resolveActiveWorkflowStage({ surface: "estimate" })).toBe("estimate");
    expect(resolveActiveWorkflowStage({ surface: "scope" })).toBe("estimate");
  });

  it("maps Export to the existing report surface", () => {
    expect(stageDestination("export")).toEqual({
      kind: "route",
      to: "/projects/$id/report",
    });
    expect(resolveActiveWorkflowStage({ surface: "report" })).toBe("export");
  });

  it("IA-4: represents Redesign as first-class /projects/$id/redesign", () => {
    const dest = stageDestination("redesign");
    expect(dest).toEqual({
      kind: "route",
      to: "/projects/$id/redesign",
    });
    expect(PROJECT_WORKFLOW_STAGES.find((s) => s.id === "redesign")?.hasImplementedRoute).toBe(
      true,
    );
    expect(resolveActiveWorkflowStage({ surface: "redesign" })).toBe("redesign");
    expect(resolveActiveWorkflowStage({ surface: "analysis" })).toBe("analysis");
  });

  it("resolves active stage deterministically", () => {
    const stages = buildProjectWorkflowStages({
      progress: {
        photosDone: true,
        analysisDone: false,
        estimateDone: false,
        reportDone: false,
        photoCount: 2,
      },
      route: { surface: "upload" },
    });
    const active = stages.filter((s) => s.isActive);
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe("photos");
  });

  it("restricts user-facing statuses to the canonical vocabulary", () => {
    const stages = buildProjectWorkflowStages({
      progress: {
        photosDone: true,
        analysisDone: true,
        estimateDone: false,
        reportDone: false,
        analysisNeedsAttention: true,
        photoCount: 3,
      },
      route: { surface: "analysis" },
    });
    for (const stage of stages) {
      expect(isCanonicalWorkflowStatus(stage.status)).toBe(true);
      expect(PROJECT_WORKFLOW_STATUS_LABELS).toContain(stage.status);
    }
    // Internal terms must never appear.
    const joined = stages.map((s) => s.status).join(" ");
    expect(joined).not.toMatch(/stale|invalid_upstream|fingerprint|revision/i);
  });

  it("IA-3-R1: current Analysis (analysisDone, no attention) → Complete", () => {
    const stages = buildProjectWorkflowStages({
      progress: {
        photosDone: true,
        analysisDone: true,
        analysisNeedsAttention: false,
        estimateDone: false,
        reportDone: false,
        photoCount: 1,
      },
      route: { surface: "analysis" },
    });
    expect(stages.find((s) => s.id === "analysis")?.status).toBe("Complete");
  });

  it("IA-3-R1: non-current Analysis → Needs attention (stale recovery)", () => {
    const stages = buildProjectWorkflowStages({
      progress: {
        photosDone: true,
        analysisDone: true,
        analysisNeedsAttention: true,
        estimateDone: false,
        reportDone: false,
        photoCount: 2,
      },
      route: { surface: "analysis" },
    });
    expect(stages.find((s) => s.id === "analysis")?.status).toBe("Needs attention");
  });

  it("never marks Redesign Complete without redesign authority", () => {
    const stages = buildProjectWorkflowStages({
      progress: {
        photosDone: true,
        analysisDone: true,
        estimateDone: true,
        reportDone: true,
        photoCount: 4,
      },
      route: { surface: "report" },
    });
    const redesign = stages.find((s) => s.id === "redesign");
    expect(redesign?.status).not.toBe("Complete");
  });

  it("renders name-only identity safely", () => {
    expect(buildProjectIdentityTitle({ name: "Victorian terrace", address: "" })).toBe(
      "Victorian terrace",
    );
    expect(
      buildProjectIdentitySubtitle({
        address: "",
        postcode: "",
        property_type: "",
      }),
    ).toBeUndefined();
    expect(
      buildProjectIdentitySubtitle({
        address: "  ",
        postcode: null,
        property_type: undefined,
      }),
    ).toBeUndefined();
  });

  it("does not require address for shell subtitle when missing", () => {
    expect(
      buildProjectIdentitySubtitle({
        address: "",
        postcode: "E1 6AN",
      }),
    ).toBe("E1 6AN");
    expect(
      buildProjectIdentitySubtitle({
        address: "12 Elm Street",
        postcode: "E1 6AN",
      }),
    ).toBe("12 Elm Street · E1 6AN");
  });
});
