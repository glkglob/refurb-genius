import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { buildProjectWorkflowStages } from "../../domain";
import { WorkflowStageProgress } from "./WorkflowStageProgress";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "WorkflowStageProgress.tsx"),
  "utf8",
);

const stages = buildProjectWorkflowStages({
  progress: {
    photosDone: true,
    analysisDone: true,
    analysisNeedsAttention: true,
    estimateDone: false,
    reportDone: false,
  },
  route: { surface: "overview" },
});

describe("WorkflowStageProgress", () => {
  it("is presentation-only and does not classify or fetch workflow state", () => {
    expect(SRC).not.toMatch(/composeProjectWorkflowState|resolveProjectNextAction/);
    expect(SRC).not.toMatch(/useProjectFiveStageWorkflow|useQuery|useQueries/);
    expect(SRC).not.toMatch(/\.from\s*\(/);
    expect(SRC).not.toMatch(/@\/platform\/supabase/);
    expect(SRC).not.toMatch(/createClient|supabase/);
  });

  it("renders five accessible dots from caller-supplied stages", () => {
    render(createElement(WorkflowStageProgress, { stages, variant: "dots" }));
    const list = screen.getByTestId("workflow-stage-progress");
    expect(list.getAttribute("data-variant")).toBe("dots");
    expect(list.getAttribute("aria-label")).toBe("Five-stage workflow progress");
    expect(screen.getByTestId("workflow-stage-marker-photos").getAttribute("data-status")).toBe(
      "Complete",
    );
    expect(screen.getByTestId("workflow-stage-marker-analysis").getAttribute("data-status")).toBe(
      "Needs attention",
    );
    expect(screen.getByLabelText("Photos: Complete")).toBeTruthy();
    expect(screen.getByLabelText("Analysis: Needs attention")).toBeTruthy();
    expect(screen.getByLabelText("Export: Not started")).toBeTruthy();
  });

  it("renders a content-aware labeled track with explicit 12px connectors, not zero-gap equal cells", () => {
    const { container } = render(
      createElement(WorkflowStageProgress, { stages, variant: "labeled-track" }),
    );
    const list = screen.getByTestId("workflow-stage-progress");
    expect(list.getAttribute("data-variant")).toBe("labeled-track");
    expect(list.className).toMatch(/min-w-0/);
    expect(list.className).not.toMatch(/lg:grid-cols-5/);
    expect(list.className).not.toMatch(/lg:gap-0/);
    expect(list.className).not.toMatch(/flex-wrap/);
    expect(screen.getByTestId("workflow-stage-cell-photos")).toBeTruthy();
    expect(screen.getByTestId("workflow-stage-cell-analysis")).toBeTruthy();
    expect(screen.getByTestId("workflow-stage-cell-redesign")).toBeTruthy();
    expect(screen.getByTestId("workflow-stage-cell-estimate")).toBeTruthy();
    expect(screen.getByTestId("workflow-stage-cell-export")).toBeTruthy();
    expect(screen.getByTestId("workflow-stage-connector-analysis").className).toMatch(/min-w-3/);
    expect(screen.getByTestId("workflow-stage-connector-redesign").className).toMatch(/min-w-3/);
    expect(screen.getByTestId("workflow-stage-connector-estimate").className).toMatch(/min-w-3/);
    expect(screen.getByTestId("workflow-stage-connector-export").className).toMatch(/min-w-3/);
    expect(screen.queryByTestId("workflow-stage-connector-photos")).toBeNull();
    const labels = [
      screen.getByTestId("workflow-stage-label-photos"),
      screen.getByTestId("workflow-stage-label-analysis"),
      screen.getByTestId("workflow-stage-label-redesign"),
      screen.getByTestId("workflow-stage-label-estimate"),
      screen.getByTestId("workflow-stage-label-export"),
    ];
    expect(labels.map((node) => node.textContent)).toEqual([
      "Photos",
      "Analysis",
      "Redesign",
      "Estimate",
      "Export",
    ]);
    expect(container.querySelector(".text-xs")).toBeTruthy();
    expect(container.querySelector(".whitespace-nowrap")).toBeTruthy();
    expect(screen.getByLabelText("Photos: Complete")).toBeTruthy();
    expect(screen.getByTestId("workflow-stage-marker-photos").className).toMatch(/\bh-4\b/);
    expect(SRC).not.toMatch(/lg:grid-cols-5/);
  });
});
