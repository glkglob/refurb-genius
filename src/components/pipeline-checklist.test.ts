import { describe, expect, it } from "vitest";
import { buildProjectPipelineSteps, CANONICAL_PIPELINE_STAGE_LABELS } from "./pipeline-checklist";

describe("buildProjectPipelineSteps (five-stage convergence)", () => {
  it("returns exactly the canonical five stages", () => {
    const steps = buildProjectPipelineSteps({
      photoCount: 0,
      analysisComplete: false,
      estimateComplete: false,
      current: "upload",
    });
    expect(steps.map((s) => s.label)).toEqual([...CANONICAL_PIPELINE_STAGE_LABELS]);
    expect(steps).toHaveLength(5);
    expect(steps.map((s) => s.id)).toEqual([
      "photos",
      "analysis",
      "redesign",
      "estimate",
      "export",
    ]);
  });

  it("does not use the legacy three-stage Upload → Analyse → Estimate labels as authority", () => {
    const steps = buildProjectPipelineSteps({
      photoCount: 1,
      analysisComplete: false,
      estimateComplete: false,
      current: "upload",
    });
    const labels = steps.map((s) => s.label);
    expect(labels).not.toEqual(["Upload", "Analyse", "Estimate"]);
    expect(labels).toContain("Redesign");
    expect(labels).toContain("Export");
  });

  it("marks upload surface as Photos active", () => {
    const steps = buildProjectPipelineSteps({
      photoCount: 0,
      analysisComplete: false,
      estimateComplete: false,
      current: "upload",
    });
    expect(steps.find((s) => s.id === "photos")?.isActive).toBe(true);
    expect(steps.filter((s) => s.isActive)).toHaveLength(1);
  });

  it("IA-3-R1: analysisHasFallback alone does not mark Analysis Needs attention", () => {
    const steps = buildProjectPipelineSteps({
      photoCount: 1,
      analysisComplete: true,
      analysisHasFallback: true,
      estimateComplete: false,
      current: "analysis",
    });
    expect(steps.find((s) => s.id === "analysis")?.statusLabel).toBe("Complete");
    expect(steps.find((s) => s.id === "analysis")?.statusLabel).not.toBe("Needs attention");
  });

  it("IA-3-R1: explicit analysisNeedsAttention marks non-current recovery", () => {
    const steps = buildProjectPipelineSteps({
      photoCount: 2,
      analysisComplete: true,
      analysisNeedsAttention: true,
      estimateComplete: false,
      current: "analysis",
    });
    expect(steps.find((s) => s.id === "analysis")?.statusLabel).toBe("Needs attention");
  });
});
