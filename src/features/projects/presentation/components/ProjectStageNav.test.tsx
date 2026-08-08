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

  it("IA-4: Redesign stage links to first-class /redesign", () => {
    render(<ProjectStageNav projectId="proj-1" stages={stages} />);
    const redesign = screen.getByRole("link", { name: /3\. Redesign/i });
    const href = redesign.getAttribute("href") ?? "";
    expect(href).toMatch(/\/redesign(?:\?|$)/);
    expect(href).not.toContain("focus=redesign");
  });

  it("exposes status as text, not colour alone", () => {
    render(<ProjectStageNav projectId="proj-1" stages={stages} />);
    // Photos Complete appears in aria-label and visible status line
    expect(screen.getAllByText("Complete").length).toBeGreaterThan(0);
  });

  it("IA-8-VR-R1: canonical stage names are fully present without truncate class", () => {
    const { container } = render(<ProjectStageNav projectId="proj-1" stages={stages} />);
    // Full names must remain available as text nodes (no ellipsis truncation).
    for (const name of ["Photos", "Analysis", "Redesign", "Estimate", "Export"]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    const source = container.innerHTML;
    // Label spans use whitespace-nowrap; stage names must not sit on .truncate.
    expect(source).toMatch(/whitespace-nowrap/);
    const truncating = [...container.querySelectorAll(".truncate")];
    for (const el of truncating) {
      expect(el.textContent).not.toMatch(/Photos|Analysis|Redesign|Estimate|Export/);
    }
  });

  it("IA-8-VR-R2: stage heading stays outside the horizontal scroller", () => {
    render(<ProjectStageNav projectId="proj-1" stages={stages} />);
    const nav = screen.getByTestId("project-stage-nav");
    const heading = screen.getByTestId("project-stage-nav-heading");
    const scroller = screen.getByTestId("project-stage-nav-scroller");
    expect(nav.contains(heading)).toBe(true);
    expect(nav.contains(scroller)).toBe(true);
    // Heading must not be a descendant of the scroller (would clip on swipe).
    expect(scroller.contains(heading)).toBe(false);
    expect(heading.textContent).toMatch(/swipe to see all five/i);
    // Scroller owns overflow-x; outer nav does not.
    expect(scroller.className).toMatch(/overflow-x-auto/);
    expect(nav.className).not.toMatch(/overflow-x-auto/);
  });

  it("IA-8-VR-R2: scroller uses snap contract and fixed mobile stage widths", () => {
    const { container } = render(<ProjectStageNav projectId="proj-1" stages={stages} />);
    const scroller = screen.getByTestId("project-stage-nav-scroller");
    expect(scroller.className).toMatch(/snap-x/);
    expect(scroller.className).toMatch(/snap-mandatory/);
    const items = container.querySelectorAll("ol > li");
    expect(items.length).toBe(5);
    for (const item of items) {
      expect(item.className).toMatch(/snap-center/);
      expect(item.className).toMatch(/w-\[9rem\]/);
    }
  });
});
