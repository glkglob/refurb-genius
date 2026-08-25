import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { WorkflowBoard } from "./WorkflowBoard";
import type { DashboardProjectSummary } from "../dashboardProjectSummary";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "WorkflowBoard.tsx"),
  "utf8",
);
const ITEM_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "WorkflowBoardItem.tsx"),
  "utf8",
);

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

describe("WorkflowBoard", () => {
  it("renders five fixed stages, counts, and each project once", () => {
    render(
      createElement(WorkflowBoard, {
        summaries: [
          summary({ projectId: "photo", name: "Photo project", stage: "photos" }),
          summary({
            projectId: "analysis",
            name: "Analysis project",
            stage: "analysis",
            stageLabel: "Analysis",
            workflowRoute: "/projects/analysis/analysis",
            nextActionLabel: "Analyse Photos",
          }),
        ],
      }),
    );
    expect(screen.getByRole("heading", { name: "Workflow Board" })).toBeTruthy();
    expect(screen.getByTestId("workflow-count-photos").textContent).toBe("1");
    expect(screen.getByTestId("workflow-count-analysis").textContent).toBe("1");
    expect(screen.getByTestId("workflow-count-redesign").textContent).toBe("0");
    expect(screen.getByTestId("workflow-count-estimate").textContent).toBe("0");
    expect(screen.getByTestId("workflow-count-export").textContent).toBe("0");
    expect(screen.getAllByTestId("workflow-board-item")).toHaveLength(2);
    expect(screen.getByTestId("board-open-photo").getAttribute("href")).toBe("/projects/p1/upload");
    expect(screen.queryByTestId("workflow-stage-list")).toBeNull();
  });

  it("uses stacked mobile layout and five desktop columns without page overflow", () => {
    const { container } = render(createElement(WorkflowBoard, { summaries: [summary()] }));
    const grid = container.querySelector("[data-testid='workflow-board'] > div");
    expect(grid?.className).toMatch(/flex-col/);
    expect(grid?.className).toMatch(/lg:grid-cols-5/);
    expect(SRC).not.toMatch(/overflow-x-auto/);
    expect(SRC).toMatch(/min-w-0/);
    expect(ITEM_SRC).not.toMatch(/draggable|onDrop|useSetProjectStage/);
    expect(ITEM_SRC).not.toMatch(/shellProgress|workflow-stage-list/);
  });
});
