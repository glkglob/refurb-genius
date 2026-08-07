/**
 * IA-2 — Canonical next-action resolver test matrix (IA-0 v1.0.1).
 *
 * Domain-level only: no React, DB, navigation, AI, or server mocks.
 */
import { describe, expect, it } from "vitest";
import { PROJECT_NEXT_ACTION_KINDS, isProjectNextActionKind } from "./nextActionKinds";
import type { ProjectWorkflowState } from "./projectWorkflowState";
import {
  buildProjectNextActionRoute,
  resolveProjectNextAction,
  type ProjectNextAction,
} from "./resolveProjectNextAction";
import { resolveProjectNextAction as resolveFromPublicApi } from "../index";

const PROJECT_ID = "proj-ia2-test";

function state(partial: Partial<ProjectWorkflowState>): ProjectWorkflowState {
  return {
    photos: { currency: "current" },
    analysis: { currency: "current" },
    redesign: { currency: "current" },
    scope: { currency: "current" },
    estimate: { currency: "current" },
    export: { currency: "current" },
    ...partial,
  };
}

function resolve(
  workflow: ProjectWorkflowState,
  entitlements?: Parameters<typeof resolveProjectNextAction>[0]["entitlements"],
): ProjectNextAction {
  return resolveProjectNextAction({ projectId: PROJECT_ID, workflow, entitlements });
}

describe("IA-2 resolveProjectNextAction — Photos", () => {
  it("no photos → photos / Ready / add_photos", () => {
    const r = resolve(
      state({
        photos: { currency: "absent" },
        analysis: { currency: "absent" },
        redesign: { currency: "absent" },
        scope: { currency: "absent" },
        estimate: { currency: "absent" },
        export: { currency: "absent" },
      }),
    );
    expect(r).toMatchObject({
      stage: "photos",
      status: "Ready",
      actionKind: "add_photos",
      route: `/projects/${PROJECT_ID}/upload`,
      label: "Add Photos",
      reason: "photos_missing",
    });
  });

  it("Photos running → view_stage_progress", () => {
    const r = resolve(
      state({
        photos: { currency: "running" },
        analysis: { currency: "absent" },
        redesign: { currency: "absent" },
        scope: { currency: "absent" },
        estimate: { currency: "absent" },
        export: { currency: "absent" },
      }),
    );
    expect(r).toMatchObject({
      stage: "photos",
      status: "In progress",
      actionKind: "view_stage_progress",
      route: `/projects/${PROJECT_ID}/upload`,
      label: "View Upload Progress",
      reason: "photos_in_progress",
    });
  });
});

describe("IA-2 resolveProjectNextAction — Analysis", () => {
  it("photos current + no Analysis → analyse_photos", () => {
    const r = resolve(
      state({
        analysis: { currency: "absent" },
        redesign: { currency: "absent" },
        scope: { currency: "absent" },
        estimate: { currency: "absent" },
        export: { currency: "absent" },
      }),
    );
    expect(r).toMatchObject({
      stage: "analysis",
      status: "Ready",
      actionKind: "analyse_photos",
      route: `/projects/${PROJECT_ID}/analysis`,
      reason: "analysis_missing",
    });
  });

  it("Analysis running → view_stage_progress", () => {
    const r = resolve(
      state({
        analysis: { currency: "running" },
        redesign: { currency: "absent" },
        scope: { currency: "absent" },
        estimate: { currency: "absent" },
        export: { currency: "absent" },
      }),
    );
    expect(r.actionKind).toBe("view_stage_progress");
    expect(r.stage).toBe("analysis");
    expect(r.status).toBe("In progress");
    expect(r.actionKind).not.toBe("analyse_photos");
  });

  it("Analysis stale → update_analysis", () => {
    const r = resolve(
      state({
        analysis: { currency: "non_current" },
        redesign: { currency: "current" },
        scope: { currency: "current" },
        estimate: { currency: "current" },
        export: { currency: "current" },
      }),
    );
    expect(r).toMatchObject({
      stage: "analysis",
      status: "Needs attention",
      actionKind: "update_analysis",
      route: `/projects/${PROJECT_ID}/analysis`,
      reason: "analysis_non_current",
    });
  });

  it("Analysis stale + downstream records → Analysis wins", () => {
    const r = resolve(
      state({
        analysis: { currency: "non_current" },
        redesign: { currency: "current" },
        scope: { currency: "current" },
        estimate: { currency: "current" },
        export: { currency: "current" },
      }),
    );
    expect(r.actionKind).toBe("update_analysis");
    expect(r.actionKind).not.toBe("view_completed_project");
    expect(r.stage).not.toBe("estimate");
    expect(r.stage).not.toBe("export");
  });
});

describe("IA-2 resolveProjectNextAction — Redesign", () => {
  it("current Analysis + no Redesign → create_redesign", () => {
    const r = resolve(
      state({
        redesign: { currency: "absent" },
        scope: { currency: "absent" },
        estimate: { currency: "absent" },
        export: { currency: "absent" },
      }),
    );
    expect(r).toMatchObject({
      stage: "redesign",
      status: "Ready",
      actionKind: "create_redesign",
      route: `/projects/${PROJECT_ID}/redesign`,
      reason: "redesign_required",
    });
  });

  it("candidates but no selection → select_redesign", () => {
    const r = resolve(
      state({
        redesign: { currency: "absent", hasUnselectedCandidates: true },
        scope: { currency: "absent" },
        estimate: { currency: "absent" },
        export: { currency: "absent" },
      }),
    );
    expect(r.actionKind).toBe("select_redesign");
    expect(r.reason).toBe("redesign_selection_required");
  });

  it("Redesign non-current → update_redesign", () => {
    const r = resolve(
      state({
        redesign: { currency: "non_current" },
        scope: { currency: "non_current" },
        estimate: { currency: "non_current" },
        export: { currency: "absent" },
      }),
    );
    expect(r).toMatchObject({
      stage: "redesign",
      status: "Needs attention",
      actionKind: "update_redesign",
    });
  });

  it("Redesign running → view_stage_progress", () => {
    const r = resolve(
      state({
        redesign: { currency: "running" },
        scope: { currency: "absent" },
        estimate: { currency: "absent" },
        export: { currency: "absent" },
      }),
    );
    expect(r).toMatchObject({
      stage: "redesign",
      status: "In progress",
      actionKind: "view_stage_progress",
      route: `/projects/${PROJECT_ID}/redesign`,
      label: "View Redesign Progress",
    });
  });

  it("missing required entitlement → unlock_redesign", () => {
    const r = resolve(
      state({
        redesign: { currency: "absent" },
        scope: { currency: "absent" },
        estimate: { currency: "absent" },
        export: { currency: "absent" },
      }),
      { redesignAllowed: false, redesignRequirement: "redesign_concepts" },
    );
    expect(r).toMatchObject({
      stage: "redesign",
      status: "Ready",
      actionKind: "unlock_redesign",
      entitlementRequirement: "redesign_concepts",
      reason: "redesign_entitlement_required",
    });
  });

  it("gated Redesign + Estimate exists → Redesign wins (not Estimate)", () => {
    const r = resolve(
      state({
        redesign: { currency: "absent" },
        scope: { currency: "current" },
        estimate: { currency: "current" },
        export: { currency: "absent" },
      }),
      { redesignAllowed: false },
    );
    expect(r.actionKind).toBe("unlock_redesign");
    expect(r.stage).toBe("redesign");
    expect(r.actionKind).not.toBe("build_estimate");
    expect(r.actionKind).not.toBe("create_export");
  });
});

describe("IA-2 resolveProjectNextAction — Scope / Estimate", () => {
  it("Scope non-current → estimate / Needs attention / reconcile_scope", () => {
    const r = resolve(
      state({
        scope: { currency: "non_current" },
        estimate: { currency: "absent" },
        export: { currency: "absent" },
      }),
    );
    expect(r).toMatchObject({
      stage: "estimate",
      status: "Needs attention",
      actionKind: "reconcile_scope",
      route: `/projects/${PROJECT_ID}/estimate`,
      label: "Review Scope",
      reason: "scope_non_current",
    });
  });

  it("Scope non-current + stale Estimate → still reconcile_scope (not update_estimate)", () => {
    const r = resolve(
      state({
        scope: { currency: "non_current" },
        estimate: { currency: "non_current" },
        export: { currency: "current" },
      }),
    );
    expect(r.actionKind).toBe("reconcile_scope");
    expect(r.actionKind).not.toBe("update_estimate");
    expect(r.actionKind).not.toBe("build_estimate");
  });

  it("Scope absent after Redesign current → reconcile_scope", () => {
    const r = resolve(
      state({
        scope: { currency: "absent" },
        estimate: { currency: "absent" },
        export: { currency: "absent" },
      }),
    );
    expect(r.actionKind).toBe("reconcile_scope");
    expect(r.stage).toBe("estimate");
  });

  it("current Scope + no Estimate → build_estimate", () => {
    const r = resolve(
      state({
        estimate: { currency: "absent" },
        export: { currency: "absent" },
      }),
    );
    expect(r).toMatchObject({
      stage: "estimate",
      status: "Ready",
      actionKind: "build_estimate",
      route: `/projects/${PROJECT_ID}/estimate`,
    });
  });

  it("current Scope + stale Estimate → update_estimate", () => {
    const r = resolve(
      state({
        estimate: { currency: "non_current" },
        export: { currency: "current" },
      }),
    );
    expect(r).toMatchObject({
      stage: "estimate",
      status: "Needs attention",
      actionKind: "update_estimate",
      reason: "estimate_non_current",
    });
  });

  it("Estimate running → view_stage_progress (not build_estimate)", () => {
    const r = resolve(
      state({
        estimate: { currency: "running" },
        export: { currency: "absent" },
      }),
    );
    expect(r.actionKind).toBe("view_stage_progress");
    expect(r.stage).toBe("estimate");
    expect(r.actionKind).not.toBe("build_estimate");
  });
});

describe("IA-2 resolveProjectNextAction — Export", () => {
  it("current Estimate + no Export → create_export", () => {
    const r = resolve(state({ export: { currency: "absent" } }));
    expect(r).toMatchObject({
      stage: "export",
      status: "Ready",
      actionKind: "create_export",
      route: `/projects/${PROJECT_ID}/report`,
      label: "Create Report",
    });
  });

  it("Export stale → update_export", () => {
    const r = resolve(state({ export: { currency: "non_current" } }));
    expect(r).toMatchObject({
      stage: "export",
      status: "Needs attention",
      actionKind: "update_export",
    });
  });

  it("Export running → view_stage_progress (not create_export)", () => {
    const r = resolve(state({ export: { currency: "running" } }));
    expect(r.actionKind).toBe("view_stage_progress");
    expect(r.stage).toBe("export");
    expect(r.actionKind).not.toBe("create_export");
  });
});

describe("IA-2 resolveProjectNextAction — Complete", () => {
  it("all required authorities current → view_completed_project", () => {
    const r = resolve(state({}));
    expect(r).toMatchObject({
      actionKind: "view_completed_project",
      status: "Complete",
      route: `/projects/${PROJECT_ID}`,
      label: "View Project",
      reason: "project_complete",
    });
    expect(r.stage).toBe("export");
  });
});

describe("IA-2 resolveProjectNextAction — Precedence", () => {
  it("Analysis stale + Estimate running → update_analysis", () => {
    const r = resolve(
      state({
        analysis: { currency: "non_current" },
        estimate: { currency: "running" },
      }),
    );
    expect(r.actionKind).toBe("update_analysis");
  });

  it("Analysis stale + Scope stale → update_analysis", () => {
    const r = resolve(
      state({
        analysis: { currency: "non_current" },
        scope: { currency: "non_current" },
      }),
    );
    expect(r.actionKind).toBe("update_analysis");
    expect(r.actionKind).not.toBe("reconcile_scope");
  });

  it("Redesign non-current + Scope stale → Redesign wins", () => {
    const r = resolve(
      state({
        redesign: { currency: "non_current" },
        scope: { currency: "non_current" },
      }),
    );
    expect(r.actionKind).toBe("update_redesign");
  });

  it("Scope stale + Estimate stale → reconcile_scope", () => {
    const r = resolve(
      state({
        scope: { currency: "non_current" },
        estimate: { currency: "non_current" },
      }),
    );
    expect(r.actionKind).toBe("reconcile_scope");
  });

  it("Estimate stale + Export running → update_estimate", () => {
    const r = resolve(
      state({
        estimate: { currency: "non_current" },
        export: { currency: "running" },
      }),
    );
    expect(r.actionKind).toBe("update_estimate");
  });

  it("Estimate running + historical Export → view_stage_progress at Estimate", () => {
    const r = resolve(
      state({
        estimate: { currency: "running" },
        export: { currency: "current" },
      }),
    );
    expect(r).toMatchObject({
      stage: "estimate",
      actionKind: "view_stage_progress",
    });
  });

  it("multiple stages running → earliest stage wins", () => {
    const r = resolve(
      state({
        photos: { currency: "running" },
        analysis: { currency: "running" },
        estimate: { currency: "running" },
      }),
    );
    expect(r.stage).toBe("photos");
    expect(r.actionKind).toBe("view_stage_progress");
  });

  it("Needs attention earlier + running later → Needs attention wins", () => {
    const r = resolve(
      state({
        analysis: { currency: "non_current" },
        export: { currency: "running" },
      }),
    );
    expect(r.actionKind).toBe("update_analysis");
  });

  it("historical Export does not win when Estimate is stale", () => {
    const r = resolve(
      state({
        estimate: { currency: "non_current" },
        export: { currency: "current" },
      }),
    );
    expect(r.actionKind).toBe("update_estimate");
    expect(r.actionKind).not.toBe("view_completed_project");
    expect(r.actionKind).not.toBe("create_export");
  });
});

describe("IA-2 resolveProjectNextAction — Legacy flag negatives", () => {
  it("stronger Analysis non_current cannot be overridden by a done-flag story", () => {
    // Resolver never accepts analysis_done — adapters must prefer non_current.
    // Constructing non_current proves done flags are not authority.
    const r = resolve(
      state({
        analysis: { currency: "non_current" },
        redesign: { currency: "current" },
        scope: { currency: "current" },
        estimate: { currency: "current" },
        export: { currency: "current" },
      }),
    );
    expect(r.actionKind).toBe("update_analysis");
    expect(r.actionKind).not.toBe("view_completed_project");
  });

  it("estimate_done-like current Estimate cannot override non-current Scope", () => {
    const r = resolve(
      state({
        scope: { currency: "non_current" },
        estimate: { currency: "current" },
        export: { currency: "current" },
      }),
    );
    expect(r.actionKind).toBe("reconcile_scope");
  });

  it("report_done-like current Export cannot override stale Estimate", () => {
    const r = resolve(
      state({
        estimate: { currency: "non_current" },
        export: { currency: "current" },
      }),
    );
    expect(r.actionKind).toBe("update_estimate");
  });

  it("generated candidates alone are not Redesign Complete", () => {
    const r = resolve(
      state({
        redesign: { currency: "absent", hasUnselectedCandidates: true },
        scope: { currency: "current" },
        estimate: { currency: "current" },
        export: { currency: "current" },
      }),
    );
    expect(r.actionKind).toBe("select_redesign");
    expect(r.actionKind).not.toBe("view_completed_project");
  });
});

describe("IA-2 resolveProjectNextAction — Purity", () => {
  it("does not mutate input objects", () => {
    const workflow = Object.freeze(
      state({
        analysis: Object.freeze({ currency: "absent" as const }),
        redesign: Object.freeze({ currency: "absent" as const }),
        scope: Object.freeze({ currency: "absent" as const }),
        estimate: Object.freeze({ currency: "absent" as const }),
        export: Object.freeze({ currency: "absent" as const }),
      }),
    );
    const before = JSON.stringify(workflow);
    resolve(workflow);
    expect(JSON.stringify(workflow)).toBe(before);
  });

  it("same input returns equal result (deterministic)", () => {
    const workflow = state({
      analysis: { currency: "absent" },
      redesign: { currency: "absent" },
      scope: { currency: "absent" },
      estimate: { currency: "absent" },
      export: { currency: "absent" },
    });
    const a = resolve(workflow);
    const b = resolve(workflow);
    expect(a).toEqual(b);
  });

  it("requires no DB/React/AI mocks — pure function only", () => {
    expect(typeof resolveProjectNextAction).toBe("function");
    const r = resolveProjectNextAction({
      projectId: "x",
      workflow: state({ photos: { currency: "absent" } }),
    });
    expect(r.actionKind).toBe("add_photos");
  });
});

describe("IA-2 resolveProjectNextAction — Routes", () => {
  it("emits exact canonical routes including first-class /redesign, never primary /scope", () => {
    const cases: Array<{ w: ProjectWorkflowState; route: string }> = [
      {
        w: state({
          photos: { currency: "absent" },
          analysis: { currency: "absent" },
          redesign: { currency: "absent" },
          scope: { currency: "absent" },
          estimate: { currency: "absent" },
          export: { currency: "absent" },
        }),
        route: `/projects/${PROJECT_ID}/upload`,
      },
      {
        w: state({
          analysis: { currency: "absent" },
          redesign: { currency: "absent" },
          scope: { currency: "absent" },
          estimate: { currency: "absent" },
          export: { currency: "absent" },
        }),
        route: `/projects/${PROJECT_ID}/analysis`,
      },
      {
        w: state({
          redesign: { currency: "absent" },
          scope: { currency: "absent" },
          estimate: { currency: "absent" },
          export: { currency: "absent" },
        }),
        route: `/projects/${PROJECT_ID}/redesign`,
      },
      {
        w: state({
          scope: { currency: "non_current" },
          estimate: { currency: "absent" },
          export: { currency: "absent" },
        }),
        route: `/projects/${PROJECT_ID}/estimate`,
      },
      {
        w: state({ export: { currency: "absent" } }),
        route: `/projects/${PROJECT_ID}/report`,
      },
      { w: state({}), route: `/projects/${PROJECT_ID}` },
    ];

    for (const c of cases) {
      const r = resolve(c.w);
      expect(r.route).toBe(c.route);
      expect(r.route).not.toMatch(/\/scope$/);
      expect(r.route).not.toContain("/scope");
      expect(r.route).not.toContain("focus=redesign");
    }
  });

  it("buildProjectNextActionRoute is pure and deterministic", () => {
    expect(buildProjectNextActionRoute("abc", "redesign_focus")).toBe("/projects/abc/redesign");
  });
});

describe("IA-2 actionKind contract", () => {
  it("includes all locked IA-0 v1.0.1 kinds including reconcile_scope and view_stage_progress", () => {
    expect(PROJECT_NEXT_ACTION_KINDS).toEqual(
      expect.arrayContaining([
        "add_photos",
        "analyse_photos",
        "update_analysis",
        "create_redesign",
        "select_redesign",
        "update_redesign",
        "unlock_redesign",
        "reconcile_scope",
        "build_estimate",
        "update_estimate",
        "create_export",
        "update_export",
        "view_stage_progress",
        "view_completed_project",
      ]),
    );
    expect(PROJECT_NEXT_ACTION_KINDS).toHaveLength(14);
    expect(isProjectNextActionKind("reconcile_scope")).toBe(true);
    expect(isProjectNextActionKind("Add Photos")).toBe(false);
  });

  it("labels are not used as semantic keys", () => {
    const r = resolve(
      state({
        photos: { currency: "absent" },
        analysis: { currency: "absent" },
        redesign: { currency: "absent" },
        scope: { currency: "absent" },
        estimate: { currency: "absent" },
        export: { currency: "absent" },
      }),
    );
    // Semantics live on actionKind; label may change without changing kind.
    expect(r.actionKind).toBe("add_photos");
    expect(typeof r.label).toBe("string");
    expect(isProjectNextActionKind(r.label)).toBe(false);
  });
});

describe("IA-2 public API exposure", () => {
  it("resolveProjectNextAction is importable from @/features/projects public barrel", () => {
    const r = resolveFromPublicApi({
      projectId: PROJECT_ID,
      workflow: state({
        photos: { currency: "absent" },
        analysis: { currency: "absent" },
        redesign: { currency: "absent" },
        scope: { currency: "absent" },
        estimate: { currency: "absent" },
        export: { currency: "absent" },
      }),
    });
    expect(r.actionKind).toBe("add_photos");
  });
});
