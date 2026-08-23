/**
 * IA-6 — Dashboard continuation card uses canonical five-stage hook + resolver.
 * PUBLIC-BETA-R1-R2 — no unsupported refurb amount / false "No estimate yet".
 * PUBLIC-BETA-R1-R2A — mock nextAction fixtures must use canonical ProjectNextAction.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { ProjectContinuationCard } from "./ProjectContinuationCard";
import type { Project } from "@/core/projects";
import type { ProjectNextAction } from "../../domain";

const useProjectFiveStageWorkflow = vi.fn();

vi.mock("../hooks/useProjectFiveStageWorkflow", () => ({
  useProjectFiveStageWorkflow: (...args: unknown[]) => useProjectFiveStageWorkflow(...args),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...rest
  }: {
    children?: React.ReactNode;
    to: string;
    [key: string]: unknown;
  }) => createElement("a", { href: typeof to === "string" ? to : "#", ...rest }, children),
}));

const baseProject = {
  id: "proj-1",
  name: "Victorian Terrace",
  region: "London",
  status: "active",
  purchase_price: 250_000,
  estimated_gdv: 350_000,
  size_sqm: 85,
  bedrooms: 3,
  bathrooms: 1,
  address: "1 High St",
  postcode: "E1 1AA",
  property_type: "Terraced",
  photos_done: true,
  analysis_done: true,
  estimate_done: true,
  report_done: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_id: "u1",
} as unknown as Project;

type ShellProgress = {
  photosDone: boolean;
  analysisDone: boolean;
  analysisNeedsAttention: boolean;
  redesignDone: boolean;
  redesignNeedsAttention: boolean;
  estimateDone: boolean;
  estimateNeedsAttention: boolean;
  reportDone: boolean;
  reportNeedsAttention: boolean;
};

const idleProgress: ShellProgress = {
  photosDone: false,
  analysisDone: false,
  analysisNeedsAttention: false,
  redesignDone: false,
  redesignNeedsAttention: false,
  estimateDone: false,
  estimateNeedsAttention: false,
  reportDone: false,
  reportNeedsAttention: false,
};

function mockWorkflow(partial: {
  loading?: boolean;
  /** Canonical resolver contract only — rejects invented actionKinds at compile time. */
  nextAction?: ProjectNextAction | null;
  shellProgress?: ShellProgress | null;
}) {
  useProjectFiveStageWorkflow.mockReturnValue({
    loading: partial.loading ?? false,
    workflow: partial.loading ? null : {},
    nextAction: partial.nextAction ?? null,
    shellProgress: partial.shellProgress === undefined ? idleProgress : partial.shellProgress,
    reload: vi.fn(),
  });
}

/** Card must not invent monetary refurb totals or false absence claims. */
function expectNoUnsupportedRefurbClaims(container: HTMLElement) {
  expect(screen.queryByTestId("project-card-refurb")).toBeNull();
  expect(container.textContent).not.toMatch(/£0\s*refurb/i);
  expect(container.textContent).not.toMatch(/No estimate yet/i);
  // Legacy 15% of baseProject GDV 350_000
  expect(container.textContent).not.toMatch(/52[,.]?500/);
  expect(container.textContent).not.toMatch(/£[\d,.]+\s*refurb/i);
}

beforeEach(() => {
  useProjectFiveStageWorkflow.mockReset();
});

describe("ProjectContinuationCard", () => {
  it("shows loading CTA while five-stage state loads", () => {
    mockWorkflow({ loading: true, nextAction: null, shellProgress: null });
    render(createElement(ProjectContinuationCard, { project: baseProject }));
    expect(screen.getByRole("button", { name: /Loading/i })).toBeTruthy();
    expect(screen.getByText(/Loading workflow status/i)).toBeTruthy();
    expect(useProjectFiveStageWorkflow).toHaveBeenCalledWith("proj-1");
  });

  it("renders resolver CTA and route for add_photos — not legacy flags", () => {
    mockWorkflow({
      nextAction: {
        stage: "photos",
        status: "Not started",
        actionKind: "add_photos",
        route: "/projects/proj-1/upload",
        label: "Add Photos",
        reason: "photos_missing",
      },
      shellProgress: idleProgress,
    });
    render(createElement(ProjectContinuationCard, { project: baseProject }));
    const cta = screen.getByTestId("workflow-continue-cta");
    expect(cta.getAttribute("href")).toBe("/projects/proj-1/upload");
    expect(cta.getAttribute("data-action-kind")).toBe("add_photos");
    expect(cta.textContent).toMatch(/Add Photos/i);
    // Legacy flags were all true — card must not claim Complete without current authorities.
    expect(screen.queryByText(/^Complete$/)).toBeNull();
  });

  it("renders view_completed_project when resolver says complete", () => {
    mockWorkflow({
      nextAction: {
        stage: "export",
        status: "Complete",
        actionKind: "view_completed_project",
        route: "/projects/proj-1",
        label: "View Project",
        reason: "project_complete",
      },
      shellProgress: {
        photosDone: true,
        analysisDone: true,
        analysisNeedsAttention: false,
        redesignDone: true,
        redesignNeedsAttention: false,
        estimateDone: true,
        estimateNeedsAttention: false,
        reportDone: true,
        reportNeedsAttention: false,
      },
    });
    render(createElement(ProjectContinuationCard, { project: baseProject }));
    const cta = screen.getByTestId("workflow-continue-cta");
    expect(cta.getAttribute("data-action-kind")).toBe("view_completed_project");
    expect(screen.getByText(/All stages current/i)).toBeTruthy();
  });

  it("shows needs-attention explanation from resolver reason", () => {
    mockWorkflow({
      nextAction: {
        stage: "analysis",
        status: "Needs attention",
        actionKind: "update_analysis",
        route: "/projects/proj-1/analysis",
        label: "Update Analysis",
        reason: "analysis_non_current",
      },
      shellProgress: {
        photosDone: true,
        analysisDone: true,
        analysisNeedsAttention: true,
        redesignDone: false,
        redesignNeedsAttention: false,
        estimateDone: false,
        estimateNeedsAttention: false,
        reportDone: false,
        reportNeedsAttention: false,
      },
    });
    render(createElement(ProjectContinuationCard, { project: baseProject }));
    expect(screen.getByTestId("next-action-reason").textContent).toMatch(/Photos changed/i);
    expect(screen.getByTestId("workflow-continue-cta").getAttribute("data-action-kind")).toBe(
      "update_analysis",
    );
  });

  it("IA-8-VR-R2: no large saturated primary media block when no cover image exists", () => {
    mockWorkflow({
      nextAction: {
        stage: "photos",
        status: "Not started",
        actionKind: "add_photos",
        route: "/projects/proj-1/upload",
        label: "Add Photos",
        reason: "photos_missing",
      },
      shellProgress: idleProgress,
    });
    const { container } = render(createElement(ProjectContinuationCard, { project: baseProject }));
    const media = screen.getByTestId("project-card-media");
    expect(media.getAttribute("data-media")).toBe("placeholder");
    // Must not use full-height saturated primary/teal empty gradient.
    expect(media.className).not.toMatch(/from-primary/);
    expect(media.className).not.toMatch(/\bh-20\b/);
    expect(media.className).not.toMatch(/\bh-28\b/);
    expect(container.innerHTML).not.toMatch(
      /h-20 bg-gradient-to-br from-primary via-primary to-accent/,
    );
    // Project name remains primary content.
    expect(screen.getByText("Victorian Terrace")).toBeTruthy();
  });

  it("featured layout exposes named five-stage status without truncating the title", () => {
    mockWorkflow({
      nextAction: {
        stage: "estimate",
        status: "Ready",
        actionKind: "build_estimate",
        route: "/projects/proj-1/estimate",
        label: "Build Estimate",
        reason: "estimate_missing",
      },
      shellProgress: {
        ...idleProgress,
        photosDone: true,
        analysisDone: true,
      },
    });
    render(createElement(ProjectContinuationCard, { project: baseProject, layout: "featured" }));
    expect(screen.getByTestId("project-continuation-card").getAttribute("data-layout")).toBe(
      "featured",
    );
    expect(screen.getByTestId("workflow-stage-list")).toBeTruthy();
    expect(screen.getByText("Photos")).toBeTruthy();
    expect(screen.getByText("Export")).toBeTruthy();
    expect(screen.getByText("Victorian Terrace")).toBeTruthy();
  });

  it("row layout uses named stages and a placeholder media strip", () => {
    mockWorkflow({
      nextAction: {
        stage: "photos",
        status: "Not started",
        actionKind: "add_photos",
        route: "/projects/proj-1/upload",
        label: "Add Photos",
        reason: "photos_missing",
      },
      shellProgress: idleProgress,
    });
    render(createElement(ProjectContinuationCard, { project: baseProject, layout: "row" }));
    expect(screen.getByTestId("project-continuation-card").getAttribute("data-layout")).toBe("row");
    expect(screen.getByTestId("workflow-stage-list")).toBeTruthy();
    expect(screen.getByTestId("project-card-media").getAttribute("data-media")).toBe("placeholder");
  });

  describe("PUBLIC-BETA-R1-R2 refurb truthfulness (no unsupported line)", () => {
    it("A: no Estimate / zero GDV — no £0, no invented total, no false absence label", () => {
      mockWorkflow({
        nextAction: {
          stage: "photos",
          status: "Not started",
          actionKind: "add_photos",
          route: "/projects/proj-1/upload",
          label: "Add Photos",
          reason: "photos_missing",
        },
        shellProgress: idleProgress,
      });
      const zeroGdv = { ...baseProject, estimated_gdv: 0, purchase_price: 0 } as Project;
      const { container } = render(createElement(ProjectContinuationCard, { project: zeroGdv }));
      expectNoUnsupportedRefurbClaims(container);
      expect(screen.getByTestId("workflow-continue-cta").getAttribute("data-action-kind")).toBe(
        "add_photos",
      );
    });

    it("B: no Estimate / non-zero GDV — 15% GDV not shown as Estimate", () => {
      mockWorkflow({
        nextAction: {
          stage: "photos",
          status: "Not started",
          actionKind: "add_photos",
          route: "/projects/proj-1/upload",
          label: "Add Photos",
          reason: "photos_missing",
        },
        shellProgress: idleProgress,
      });
      const { container } = render(
        createElement(ProjectContinuationCard, { project: baseProject }),
      );
      expectNoUnsupportedRefurbClaims(container);
      expect(screen.getByTestId("workflow-continue-cta").getAttribute("data-action-kind")).toBe(
        "add_photos",
      );
    });

    it("C: Estimate Ready — must not imply monetary Estimate exists", () => {
      mockWorkflow({
        nextAction: {
          stage: "estimate",
          status: "Ready",
          actionKind: "build_estimate",
          route: "/projects/proj-1/estimate",
          label: "Build Estimate",
          reason: "estimate_missing",
        },
        shellProgress: {
          photosDone: true,
          analysisDone: true,
          analysisNeedsAttention: false,
          redesignDone: true,
          redesignNeedsAttention: false,
          estimateDone: false,
          estimateNeedsAttention: false,
          reportDone: false,
          reportNeedsAttention: false,
        },
      });
      const { container } = render(
        createElement(ProjectContinuationCard, { project: baseProject }),
      );
      expectNoUnsupportedRefurbClaims(container);
      expect(screen.getByTestId("workflow-continue-cta").getAttribute("data-action-kind")).toBe(
        "build_estimate",
      );
    });

    it("D: Estimate In progress — must not say No estimate yet", () => {
      mockWorkflow({
        nextAction: {
          stage: "estimate",
          status: "In progress",
          actionKind: "view_stage_progress",
          route: "/projects/proj-1/estimate",
          label: "View Estimate Progress",
          reason: "estimate_in_progress",
        },
        shellProgress: {
          photosDone: true,
          analysisDone: true,
          analysisNeedsAttention: false,
          redesignDone: true,
          redesignNeedsAttention: false,
          // In progress: shell flags not complete; CTA is view_stage_progress
          estimateDone: false,
          estimateNeedsAttention: false,
          reportDone: false,
          reportNeedsAttention: false,
        },
      });
      const { container } = render(
        createElement(ProjectContinuationCard, { project: baseProject }),
      );
      expectNoUnsupportedRefurbClaims(container);
      expect(screen.getByTestId("workflow-continue-cta").getAttribute("data-action-kind")).toBe(
        "view_stage_progress",
      );
    });

    it("E: Estimate Needs attention — must not say No estimate yet or invent total", () => {
      mockWorkflow({
        nextAction: {
          stage: "estimate",
          status: "Needs attention",
          actionKind: "update_estimate",
          route: "/projects/proj-1/estimate",
          label: "Update Estimate",
          reason: "estimate_non_current",
        },
        shellProgress: {
          photosDone: true,
          analysisDone: true,
          analysisNeedsAttention: false,
          redesignDone: true,
          redesignNeedsAttention: false,
          estimateDone: true,
          estimateNeedsAttention: true,
          reportDone: false,
          reportNeedsAttention: false,
        },
      });
      const { container } = render(
        createElement(ProjectContinuationCard, { project: baseProject }),
      );
      expectNoUnsupportedRefurbClaims(container);
      expect(screen.getByTestId("workflow-continue-cta").getAttribute("data-action-kind")).toBe(
        "update_estimate",
      );
    });

    it("F: Estimate Complete/current — must not say No estimate yet or invent total", () => {
      mockWorkflow({
        nextAction: {
          stage: "export",
          status: "Ready",
          actionKind: "create_export",
          route: "/projects/proj-1/report",
          label: "Create Report",
          reason: "export_missing",
        },
        shellProgress: {
          photosDone: true,
          analysisDone: true,
          analysisNeedsAttention: false,
          redesignDone: true,
          redesignNeedsAttention: false,
          estimateDone: true,
          estimateNeedsAttention: false,
          reportDone: false,
          reportNeedsAttention: false,
        },
      });
      const { container } = render(
        createElement(ProjectContinuationCard, { project: baseProject }),
      );
      expectNoUnsupportedRefurbClaims(container);
      expect(screen.getByTestId("workflow-continue-cta").getAttribute("data-action-kind")).toBe(
        "create_export",
      );
    });

    it("G: workflow loading — no transient £0 and no false absence claim", () => {
      mockWorkflow({ loading: true, nextAction: null, shellProgress: null });
      const zeroGdv = { ...baseProject, estimated_gdv: 0 } as Project;
      const { container } = render(createElement(ProjectContinuationCard, { project: zeroGdv }));
      expectNoUnsupportedRefurbClaims(container);
      expect(screen.getByRole("button", { name: /Loading/i })).toBeTruthy();
    });

    it("H: resolver CTA actionKind preserved across refurb omission", () => {
      mockWorkflow({
        nextAction: {
          stage: "photos",
          status: "Not started",
          actionKind: "add_photos",
          route: "/projects/proj-1/upload",
          label: "Add Photos",
          reason: "photos_missing",
        },
        shellProgress: idleProgress,
      });
      render(createElement(ProjectContinuationCard, { project: baseProject }));
      expect(screen.getByTestId("workflow-continue-cta").getAttribute("data-action-kind")).toBe(
        "add_photos",
      );
      expect(screen.getByTestId("open-overview")).toBeTruthy();
      expect(screen.getByTestId("workflow-stage-bars")).toBeTruthy();
    });
  });
});
