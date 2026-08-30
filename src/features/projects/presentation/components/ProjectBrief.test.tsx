import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { ProjectBrief } from "./ProjectBrief";
import type { DashboardProjectSummary } from "../dashboardProjectSummary";
import { buildProjectWorkflowStages } from "../../domain";

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

function summary(overrides: Partial<DashboardProjectSummary> = {}): DashboardProjectSummary {
  return {
    projectId: "p1",
    name: "Alpha",
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

describe("ProjectBrief", () => {
  it("shows ranked rows, canonical status, workflow CTA, and hide control without KPIs", () => {
    const onHide = vi.fn();
    render(
      createElement(ProjectBrief, {
        onHide,
        summaries: [
          summary({
            projectId: "done",
            name: "Done",
            status: "Complete",
            nextActionKind: "view_completed_project",
            nextActionLabel: "View Project",
            listOrder: 0,
          }),
          summary({
            projectId: "attn",
            name: "Needs work",
            status: "Needs attention",
            nextActionLabel: "Update Analysis",
            workflowRoute: "/projects/attn/analysis",
            reasonExplanation: "Analysis requires updating because Photos changed.",
            listOrder: 1,
          }),
          summary({ projectId: "ready", name: "Ready one", listOrder: 2 }),
        ],
      }),
    );
    const heading = screen.getByRole("heading", { name: "Project Brief" });
    expect(heading).toBeTruthy();
    expect(heading.className).toMatch(/\bfont-serif\b/);
    expect(screen.getByText("The next actions that need a decision.")).toBeTruthy();
    expect(screen.getByTestId("project-brief-hide").textContent).toMatch(/Hide/);
    expect(screen.queryByTestId("brief-count-attention")).toBeNull();
    expect(screen.queryByTestId("brief-count-progress")).toBeNull();
    expect(screen.queryByTestId("brief-count-ready")).toBeNull();
    expect(screen.queryByTestId("brief-count-complete")).toBeNull();
    expect(screen.getByText("Needs work")).toBeTruthy();
    expect(screen.queryByText("Done")).toBeNull();
    expect(screen.getByTestId("brief-status-attn").textContent).toBe("Needs attention");
    expect(screen.getByText("Analysis requires updating because Photos changed.")).toBeTruthy();
    const cta = screen.getByTestId("brief-cta-attn");
    expect(cta.getAttribute("href")).toBe("/projects/attn/analysis");
    expect(cta.textContent).toMatch(/Update Analysis/);
    expect(screen.queryByTestId("workflow-stage-list")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    fireEvent.click(screen.getByTestId("project-brief-hide"));
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("project-brief-hide").className).toMatch(/min-h-11/);
  });
});
