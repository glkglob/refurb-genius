/**
 * IA-6 — Dashboard continuation card uses canonical five-stage hook + resolver.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { ProjectContinuationCard } from "./ProjectContinuationCard";
import type { Project } from "@/core/projects";

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

beforeEach(() => {
  useProjectFiveStageWorkflow.mockReset();
});

describe("ProjectContinuationCard", () => {
  it("shows loading CTA while five-stage state loads", () => {
    useProjectFiveStageWorkflow.mockReturnValue({
      loading: true,
      workflow: null,
      nextAction: null,
      shellProgress: null,
      reload: vi.fn(),
    });
    render(createElement(ProjectContinuationCard, { project: baseProject }));
    expect(screen.getByRole("button", { name: /Loading/i })).toBeTruthy();
    expect(screen.getByText(/Loading workflow status/i)).toBeTruthy();
    expect(useProjectFiveStageWorkflow).toHaveBeenCalledWith("proj-1");
  });

  it("renders resolver CTA and route for add_photos — not legacy flags", () => {
    useProjectFiveStageWorkflow.mockReturnValue({
      loading: false,
      workflow: {},
      nextAction: {
        stage: "photos",
        status: "Not started",
        actionKind: "add_photos",
        route: "/projects/proj-1/upload",
        label: "Add Photos",
        reason: "photos_missing",
      },
      shellProgress: {
        photosDone: false,
        analysisDone: false,
        analysisNeedsAttention: false,
        redesignDone: false,
        redesignNeedsAttention: false,
        estimateDone: false,
        estimateNeedsAttention: false,
        reportDone: false,
        reportNeedsAttention: false,
      },
      reload: vi.fn(),
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
    useProjectFiveStageWorkflow.mockReturnValue({
      loading: false,
      workflow: {},
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
      reload: vi.fn(),
    });
    render(createElement(ProjectContinuationCard, { project: baseProject }));
    const cta = screen.getByTestId("workflow-continue-cta");
    expect(cta.getAttribute("data-action-kind")).toBe("view_completed_project");
    expect(screen.getByText(/All stages current/i)).toBeTruthy();
  });

  it("shows needs-attention explanation from resolver reason", () => {
    useProjectFiveStageWorkflow.mockReturnValue({
      loading: false,
      workflow: {},
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
      reload: vi.fn(),
    });
    render(createElement(ProjectContinuationCard, { project: baseProject }));
    expect(screen.getByTestId("next-action-reason").textContent).toMatch(/Photos changed/i);
    expect(screen.getByTestId("workflow-continue-cta").getAttribute("data-action-kind")).toBe(
      "update_analysis",
    );
  });

  it("IA-8-VR-R2: no large saturated primary media block when no cover image exists", () => {
    useProjectFiveStageWorkflow.mockReturnValue({
      loading: false,
      workflow: {},
      nextAction: {
        stage: "photos",
        status: "Not started",
        actionKind: "add_photos",
        route: "/projects/proj-1/upload",
        label: "Add Photos",
        reason: "photos_missing",
      },
      shellProgress: {
        photosDone: false,
        analysisDone: false,
        analysisNeedsAttention: false,
        redesignDone: false,
        redesignNeedsAttention: false,
        estimateDone: false,
        estimateNeedsAttention: false,
        reportDone: false,
        reportNeedsAttention: false,
      },
      reload: vi.fn(),
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

  it("PUBLIC-BETA-R1: zero GDV does not render bare £0 refurb", () => {
    useProjectFiveStageWorkflow.mockReturnValue({
      loading: false,
      workflow: {},
      nextAction: {
        stage: "photos",
        status: "Not started",
        actionKind: "add_photos",
        route: "/projects/proj-1/upload",
        label: "Add Photos",
        reason: "photos_missing",
      },
      shellProgress: {
        photosDone: false,
        analysisDone: false,
        analysisNeedsAttention: false,
        redesignDone: false,
        redesignNeedsAttention: false,
        estimateDone: false,
        estimateNeedsAttention: false,
        reportDone: false,
        reportNeedsAttention: false,
      },
      reload: vi.fn(),
    });
    const zeroGdv = { ...baseProject, estimated_gdv: 0, purchase_price: 0 } as Project;
    render(createElement(ProjectContinuationCard, { project: zeroGdv }));
    const refurb = screen.getByTestId("project-card-refurb");
    expect(refurb.getAttribute("data-refurb-mode")).toBe("no_estimate");
    expect(refurb.textContent).toMatch(/No estimate yet/i);
    expect(refurb.textContent).not.toMatch(/£0/);
    expect(screen.getByTestId("workflow-continue-cta")).toBeTruthy();
  });

  it("PUBLIC-BETA-R1: non-zero GDV placeholder is not shown as card Estimate total", () => {
    useProjectFiveStageWorkflow.mockReturnValue({
      loading: false,
      workflow: {},
      nextAction: {
        stage: "photos",
        status: "Not started",
        actionKind: "add_photos",
        route: "/projects/proj-1/upload",
        label: "Add Photos",
        reason: "photos_missing",
      },
      shellProgress: {
        photosDone: false,
        analysisDone: false,
        analysisNeedsAttention: false,
        redesignDone: false,
        redesignNeedsAttention: false,
        estimateDone: false,
        estimateNeedsAttention: false,
        reportDone: false,
        reportNeedsAttention: false,
      },
      reload: vi.fn(),
    });
    // baseProject estimated_gdv 350_000 → legacy 15% would be £52,500
    render(createElement(ProjectContinuationCard, { project: baseProject }));
    const refurb = screen.getByTestId("project-card-refurb");
    expect(refurb.textContent).toBe("No estimate yet");
    expect(refurb.textContent).not.toMatch(/52[,.]?500/);
    expect(refurb.textContent).not.toMatch(/£/);
    // Resolver CTA preserved
    expect(screen.getByTestId("workflow-continue-cta").getAttribute("data-action-kind")).toBe(
      "add_photos",
    );
  });

  it("PUBLIC-BETA-R1: loading workflow does not invent a bare £0 refurb amount", () => {
    useProjectFiveStageWorkflow.mockReturnValue({
      loading: true,
      workflow: null,
      nextAction: null,
      shellProgress: null,
      reload: vi.fn(),
    });
    const zeroGdv = { ...baseProject, estimated_gdv: 0 } as Project;
    render(createElement(ProjectContinuationCard, { project: zeroGdv }));
    const refurb = screen.getByTestId("project-card-refurb");
    expect(refurb.textContent).toMatch(/No estimate yet/i);
    expect(refurb.textContent).not.toMatch(/£0/);
  });
});
