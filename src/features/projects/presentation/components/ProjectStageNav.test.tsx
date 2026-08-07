import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { buildProjectWorkflowStages } from "../../domain/workflowStages";
import { ProjectStageNav } from "./ProjectStageNav";

// TanStack Link needs a router in full app tests; for unit chrome we mock Link.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
    ...rest
  }: {
    children: ReactNode;
    to: string;
    search?: Record<string, unknown>;
    params?: Record<string, string>;
    className?: string;
    "aria-current"?: "page" | "step" | "location" | "date" | "time" | "true" | "false" | boolean;
    "aria-label"?: string;
  }) => (
    <a
      href={
        typeof to === "string"
          ? `${to.replace("$id", "proj-1")}${search?.focus ? `?focus=${String(search.focus)}` : ""}`
          : "#"
      }
      aria-current={rest["aria-current"]}
      aria-label={rest["aria-label"]}
      className={rest.className}
    >
      {children}
    </a>
  ),
}));

describe("ProjectStageNav", () => {
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

  it("exposes semantic navigation and five stages", () => {
    render(<ProjectStageNav projectId="proj-1" stages={stages} />);
    const nav = screen.getByRole("navigation", { name: /project workflow stages/i });
    expect(nav).toBeTruthy();
    expect(screen.getByText("Photos")).toBeTruthy();
    expect(screen.getByText("Analysis")).toBeTruthy();
    expect(screen.getByText("Redesign")).toBeTruthy();
    expect(screen.getByText("Estimate")).toBeTruthy();
    expect(screen.getByText("Export")).toBeTruthy();
  });

  it("marks the active stage for assistive technology", () => {
    render(<ProjectStageNav projectId="proj-1" stages={stages} />);
    const active = screen.getByRole("link", { name: /1\. Photos, Complete/i });
    expect(active.getAttribute("aria-current")).toBe("step");
  });

  it("does not create a /redesign href for Redesign", () => {
    render(<ProjectStageNav projectId="proj-1" stages={stages} />);
    const redesign = screen.getByRole("link", { name: /3\. Redesign/i });
    const href = redesign.getAttribute("href") ?? "";
    expect(href).not.toMatch(/\/redesign(?:\?|$)/);
    expect(href).toMatch(/analysis/);
  });

  it("exposes status as text, not colour alone", () => {
    render(<ProjectStageNav projectId="proj-1" stages={stages} />);
    // Photos Complete appears in aria-label and visible status line
    expect(screen.getAllByText("Complete").length).toBeGreaterThan(0);
  });
});
