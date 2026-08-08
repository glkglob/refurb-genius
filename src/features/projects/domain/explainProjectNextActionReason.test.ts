/**
 * IA-6 — Reason explanations and workflow health helpers.
 */
import { describe, it, expect } from "vitest";
import {
  explainProjectNextActionReason,
  workflowAllStagesComplete,
  workflowHasNeedsAttention,
} from "./explainProjectNextActionReason";
import {
  buildProjectWorkflowStages,
  progressFromProjectFlags,
  resolveProjectNextAction,
  composeProjectWorkflowState,
} from "./index";

describe("explainProjectNextActionReason", () => {
  it("explains analysis stale without internal IDs", () => {
    const text = explainProjectNextActionReason("analysis_non_current");
    expect(text).toMatch(/Photos changed/i);
    expect(text).not.toMatch(/identity|revision|fingerprint/i);
  });

  it("explains redesign stale", () => {
    expect(explainProjectNextActionReason("redesign_non_current")).toMatch(/Analysis changed/i);
  });

  it("explains scope / estimate / export chain", () => {
    expect(explainProjectNextActionReason("scope_non_current")).toMatch(/Scope/i);
    expect(explainProjectNextActionReason("estimate_non_current")).toMatch(/Scope changed/i);
    expect(explainProjectNextActionReason("export_non_current")).toMatch(/Estimate changed/i);
  });

  it("explains completed project", () => {
    expect(explainProjectNextActionReason("project_complete")).toMatch(/current/i);
  });

  it("returns empty for unknown reason", () => {
    expect(explainProjectNextActionReason("not_a_real_reason")).toBe("");
  });
});

describe("legacy progressFromProjectFlags cannot claim Dashboard/Overview authority", () => {
  it("legacy flags alone do not produce view_completed_project", () => {
    // Compose with empty durable evidence — even if flags would say "done".
    const workflow = composeProjectWorkflowState({
      photos: [],
      analyses: [],
      redesignCandidates: [],
      scope: null,
      estimate: null,
      exportSnapshot: null,
    });
    const next = resolveProjectNextAction({ projectId: "p1", workflow });
    expect(next.actionKind).toBe("add_photos");
    expect(next.actionKind).not.toBe("view_completed_project");
  });

  it("progressFromProjectFlags still maps booleans but shell must not use them alone for Complete", () => {
    const flags = progressFromProjectFlags({
      photos_done: true,
      analysis_done: true,
      estimate_done: true,
      report_done: true,
    });
    // Without redesignDone / needs-attention from currentness, redesign is not Complete.
    const stages = buildProjectWorkflowStages({
      progress: flags,
      route: { surface: "overview" },
    });
    const redesign = stages.find((s) => s.id === "redesign");
    expect(redesign?.status).not.toBe("Complete");
  });
});

describe("workflow health helpers", () => {
  it("detects needs attention and all complete", () => {
    expect(workflowHasNeedsAttention([{ status: "Complete" }, { status: "Needs attention" }])).toBe(
      true,
    );
    expect(workflowAllStagesComplete([{ status: "Complete" }, { status: "Complete" }])).toBe(true);
    expect(workflowAllStagesComplete([{ status: "Complete" }, { status: "Ready" }])).toBe(false);
  });
});
