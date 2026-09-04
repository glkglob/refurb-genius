import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { ProjectBrief } from "./ProjectBrief";
import type { DashboardProjectSummary } from "../dashboardProjectSummary";

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
    ...overrides,
  };
}

describe("ProjectBrief", () => {
  it("shows ranked rows, workflow CTA, and hide control without a status-count snapshot", () => {
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
    expect(screen.getByRole("heading", { name: "Project Brief" })).toBeTruthy();
    expect(screen.queryByTestId("brief-count-attention")).toBeNull();
    expect(screen.queryByTestId("brief-count-progress")).toBeNull();
    expect(screen.queryByTestId("brief-count-ready")).toBeNull();
    expect(screen.queryByTestId("brief-count-complete")).toBeNull();
    expect(screen.getByText("Needs work")).toBeTruthy();
    expect(screen.queryByText("Done")).toBeNull();
    const cta = screen.getByTestId("brief-cta-attn");
    expect(cta.getAttribute("href")).toBe("/projects/attn/analysis");
    expect(cta.textContent).toMatch(/Update Analysis/);
    expect(screen.queryByTestId("workflow-stage-list")).toBeNull();
    fireEvent.click(screen.getByTestId("project-brief-hide"));
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("project-brief-hide").className).toMatch(/min-h-11/);
  });
});
