import { describe, expect, it } from "vitest";
import {
  briefActionableItems,
  briefStatusCounts,
  buildDashboardWorkflowStages,
  deriveCurrentScopeIdForEstimate,
  groupSummariesByStage,
  shellProgressFromWorkflow,
  toDashboardProjectSummary,
  workflowBoardColumns,
  type DashboardProjectSummary,
} from "./dashboardProjectSummary";
import {
  buildProjectWorkflowStages,
  type ProjectNextAction,
  type ProjectWorkflowState,
} from "../domain";

function idleStages() {
  return buildProjectWorkflowStages({
    progress: {
      photosDone: false,
      analysisDone: false,
      estimateDone: false,
      reportDone: false,
    },
    route: { surface: "overview" },
  });
}

function action(overrides: Partial<ProjectNextAction> = {}): ProjectNextAction {
  return {
    stage: "photos",
    status: "Ready",
    actionKind: "add_photos",
    route: "/projects/p1/upload",
    label: "Add Photos",
    reason: "photos_missing",
    ...overrides,
  };
}

function summary(overrides: Partial<DashboardProjectSummary> = {}): DashboardProjectSummary {
  return {
    projectId: "p1",
    name: "One",
    location: "London",
    stage: "photos",
    stageLabel: "Photos",
    status: "Ready",
    nextActionKind: "add_photos",
    nextActionLabel: "Add Photos",
    reason: "photos_missing",
    reasonExplanation: "Add room photos to begin the project workflow.",
    workflowRoute: "/projects/p1/upload",
    overviewRoute: "/projects/p1",
    listOrder: 0,
    workflowStages: idleStages(),
    ...overrides,
  };
}

describe("deriveCurrentScopeIdForEstimate", () => {
  const photoA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("returns the scope id when analysis and selected redesign identities match", () => {
    const id = deriveCurrentScopeIdForEstimate({
      photos: [{ id: photoA }],
      analyses: [{ photoId: photoA, source: "ai" }],
      redesignCandidates: [
        { id: "r1", style: "Modern", analysisIdentity: photoA, isSelected: true },
      ],
      scope: { id: "s1", analysisIdentity: photoA, redesignIdentity: "r1" },
    });
    expect(id).toBe("s1");
  });

  it("returns null when scope identities do not match current analysis", () => {
    const id = deriveCurrentScopeIdForEstimate({
      photos: [{ id: photoA }],
      analyses: [{ photoId: photoA, source: "ai" }],
      redesignCandidates: [
        { id: "r1", style: "Modern", analysisIdentity: photoA, isSelected: true },
      ],
      scope: { id: "s1", analysisIdentity: "other", redesignIdentity: "r1" },
    });
    expect(id).toBeNull();
  });

  it("returns null when there is no scope header", () => {
    expect(
      deriveCurrentScopeIdForEstimate({
        photos: [{ id: photoA }],
        analyses: [{ photoId: photoA, source: "ai" }],
        redesignCandidates: [
          { id: "r1", style: "Modern", analysisIdentity: photoA, isSelected: true },
        ],
        scope: null,
      }),
    ).toBeNull();
  });
});

describe("toDashboardProjectSummary", () => {
  it("maps identity helpers and resolver fields", () => {
    const stages = idleStages();
    const out = toDashboardProjectSummary(
      { id: "p9", name: "Terrace", address: "1 High St", postcode: "E1 1AA" },
      action({ route: "/projects/p9/upload" }),
      2,
      stages,
    );
    expect(out.projectId).toBe("p9");
    expect(out.name).toBe("Terrace");
    expect(out.location).toMatch(/1 High St/);
    expect(out.stage).toBe("photos");
    expect(out.stageLabel).toBe("Photos");
    expect(out.workflowRoute).toBe("/projects/p9/upload");
    expect(out.overviewRoute).toBe("/projects/p9");
    expect(out.listOrder).toBe(2);
    expect(out.workflowStages).toHaveLength(5);
    expect(out.status).toBe("Ready");
  });
});

describe("shell-progress parity with useProjectFiveStageWorkflow", () => {
  it("maps currency to the same done / needs-attention flags then five stages", () => {
    const workflow: ProjectWorkflowState = {
      photos: { currency: "current", photoCount: 2 },
      analysis: { currency: "non_current" },
      redesign: { currency: "absent" },
      scope: { currency: "absent" },
      estimate: { currency: "absent" },
      export: { currency: "absent" },
    };
    const progress = shellProgressFromWorkflow(workflow);
    expect(progress).toEqual({
      photosDone: true,
      analysisDone: true,
      analysisNeedsAttention: true,
      redesignDone: false,
      redesignNeedsAttention: false,
      estimateDone: false,
      estimateNeedsAttention: false,
      reportDone: false,
      reportNeedsAttention: false,
    });
    const stages = buildDashboardWorkflowStages(workflow);
    expect(stages.map((stage) => stage.id)).toEqual([
      "photos",
      "analysis",
      "redesign",
      "estimate",
      "export",
    ]);
    expect(stages.find((stage) => stage.id === "photos")?.status).toBe("Complete");
    expect(stages.find((stage) => stage.id === "analysis")?.status).toBe("Needs attention");
    expect(stages.find((stage) => stage.id === "redesign")?.status).toBe("Ready");
  });

  it("surfaces Estimate needs attention when Scope is absent after current Analysis and Redesign", () => {
    const workflow: ProjectWorkflowState = {
      photos: { currency: "current" },
      analysis: { currency: "current" },
      redesign: { currency: "current" },
      scope: { currency: "absent" },
      estimate: { currency: "absent" },
      export: { currency: "absent" },
    };
    const progress = shellProgressFromWorkflow(workflow);
    expect(progress.estimateNeedsAttention).toBe(true);
    expect(
      buildDashboardWorkflowStages(workflow).find((stage) => stage.id === "estimate")?.status,
    ).toBe("Needs attention");
  });
});

describe("grouping and counts", () => {
  const rows = [
    summary({ projectId: "a", stage: "analysis", stageLabel: "Analysis", listOrder: 1 }),
    summary({ projectId: "b", stage: "photos", listOrder: 0 }),
    summary({
      projectId: "c",
      stage: "export",
      stageLabel: "Export",
      status: "Complete",
      nextActionKind: "view_completed_project",
      listOrder: 2,
    }),
  ];

  it("uses fixed five-stage order and places each project once", () => {
    const columns = workflowBoardColumns(rows);
    expect(columns.map((column) => column.id)).toEqual([
      "photos",
      "analysis",
      "redesign",
      "estimate",
      "export",
    ]);
    expect(columns.map((column) => column.count)).toEqual([1, 1, 0, 0, 1]);
    const ids = columns.flatMap((column) => column.projects.map((item) => item.projectId));
    expect(ids.sort()).toEqual(["a", "b", "c"]);
    expect(ids).toHaveLength(3);
  });

  it("keeps zero-count stages and preserves listOrder within a stage", () => {
    const groups = groupSummariesByStage([
      summary({ projectId: "later", stage: "photos", listOrder: 5 }),
      summary({ projectId: "earlier", stage: "photos", listOrder: 1 }),
    ]);
    expect(groups.redesign).toEqual([]);
    expect(groups.photos.map((item) => item.projectId)).toEqual(["earlier", "later"]);
  });
});

describe("Project Brief ranking", () => {
  it("counts complete separately and omits completed rows from the max-three list", () => {
    const rows = [
      summary({
        projectId: "done",
        status: "Complete",
        nextActionKind: "view_completed_project",
        listOrder: 0,
      }),
      summary({
        projectId: "attn",
        status: "Needs attention",
        stage: "analysis",
        listOrder: 2,
      }),
      summary({ projectId: "ready-b", status: "Ready", listOrder: 3 }),
      summary({ projectId: "prog", status: "In progress", listOrder: 1 }),
      summary({ projectId: "ready-a", status: "Ready", listOrder: 4 }),
      summary({ projectId: "ready-c", status: "Ready", listOrder: 5 }),
    ];
    const counts = briefStatusCounts(rows);
    expect(counts).toEqual({
      needsAttention: 1,
      inProgress: 1,
      ready: 3,
      complete: 1,
    });
    const actionable = briefActionableItems(rows, 3);
    expect(actionable.map((item) => item.projectId)).toEqual(["attn", "prog", "ready-b"]);
    expect(actionable).toHaveLength(3);
    expect(actionable.some((item) => item.projectId === "done")).toBe(false);
  });

  it("uses listOrder as a stable tie-break within the same priority", () => {
    const rows = [
      summary({ projectId: "second", status: "Ready", listOrder: 8 }),
      summary({ projectId: "first", status: "Ready", listOrder: 3 }),
    ];
    expect(briefActionableItems(rows, 3).map((item) => item.projectId)).toEqual([
      "first",
      "second",
    ]);
  });
});
