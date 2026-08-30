/**
 * Projects index — uniform compact rows (no featured first project).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import type { ProjectNextAction } from "@/features/projects/domain";

const useProjects = vi.fn();
const useProjectFiveStageWorkflow = vi.fn();

vi.mock("@/hooks/useProjects", () => ({
  useProjects: (...args: unknown[]) => useProjects(...args),
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({
    children,
    title,
  }: {
    children: ReactNode;
    title?: string;
    showDealCopilotRail?: boolean;
  }) =>
    createElement(
      "div",
      { "data-testid": "app-layout" },
      title ? createElement("h1", null, title) : null,
      children,
    ),
}));

vi.mock("@/features/projects/presentation/hooks/useProjectFiveStageWorkflow", () => ({
  useProjectFiveStageWorkflow: (...args: unknown[]) => useProjectFiveStageWorkflow(...args),
}));

vi.mock("@/features/ai-upload", () => ({
  usePhotos: () => ({ data: [] }),
  useProjectPhotoDisplayUrl: () => ({ data: undefined }),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: { component: unknown; head?: unknown }) => ({
    options: opts,
    path,
  }),
  Link: ({ children, to, ...rest }: { children?: ReactNode; to: string; [key: string]: unknown }) =>
    createElement("a", { href: typeof to === "string" ? to : "#", ...rest }, children),
}));

import { Route } from "./projects.index";

const ProjectsPage = Route.options.component as () => ReactNode;

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

const photosAction: ProjectNextAction = {
  stage: "photos",
  status: "Not started",
  actionKind: "add_photos",
  route: "/projects/p1/upload",
  label: "Add Photos",
  reason: "photos_missing",
};

function mockWorkflow() {
  useProjectFiveStageWorkflow.mockReturnValue({
    loading: false,
    workflow: {},
    nextAction: photosAction,
    shellProgress: idleProgress,
    reload: vi.fn(),
  });
}

const terrace = {
  id: "p1",
  name: "22 Kensington Road",
  address: "22 Kensington Road",
  postcode: "W8 5AB",
  region: "London",
};

const oakwood = {
  id: "p2",
  name: "45 Oakwood Avenue",
  address: "45 Oakwood Avenue",
  postcode: "HA5 3AA",
  region: "London",
};

function renderProjects() {
  return render(createElement(ProjectsPage as never));
}

beforeEach(() => {
  useProjects.mockReset();
  useProjectFiveStageWorkflow.mockReset();
  useProjects.mockReturnValue({
    data: [terrace, oakwood],
    isLoading: false,
    isError: false,
    error: null,
  });
  mockWorkflow();
});

describe("Projects index uniform row presentation", () => {
  it("renders the Projects heading and search", () => {
    renderProjects();
    const heading = screen.getByRole("heading", { name: "Projects" });
    expect(heading).toBeTruthy();
    expect(heading.className).toMatch(/\bfont-serif\b/);
    const search = screen.getByTestId("projects-index-search");
    expect(search).toBeTruthy();
    expect(search.parentElement?.className).toMatch(/max-w-sm/);
    expect(search.parentElement?.className).not.toMatch(/max-w-md/);
  });

  it("renders every project as a compact row, including the first", () => {
    renderProjects();
    const cards = screen.getAllByTestId("project-continuation-card");
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.getAttribute("data-layout")).toBe("row");
      expect(card.getAttribute("data-layout")).not.toBe("featured");
    }
    expect(screen.getByTestId("projects-index-grid").className).toMatch(/gap-4/);
    expect(screen.getByTestId("projects-index-grid").className).not.toMatch(/divide-y/);
  });

  it("does not present Dashboard continuation hierarchy", () => {
    renderProjects();
    expect(screen.queryByText("Continue where you left off")).toBeNull();
    expect(screen.queryByText("Other projects")).toBeNull();
    expect(screen.queryByTestId("dashboard-featured-project")).toBeNull();
    expect(screen.queryByTestId("dashboard-project-rows")).toBeNull();
  });

  it("keeps Open project and five-stage presentation, not a list resolver CTA", () => {
    renderProjects();
    const cards = screen.getAllByTestId("project-continuation-card");
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      const open = within(card).getByTestId("open-overview");
      expect(open.textContent).toMatch(/Open project/i);
      expect(open.tagName).toBe("A");
      const track = within(card).getByTestId("workflow-stage-progress");
      expect(track.getAttribute("data-variant")).toBe("labeled-track");
      expect(track.className).not.toMatch(/lg:grid-cols-5/);
      expect(within(card).getByTestId("workflow-stage-label-photos").textContent).toBe("Photos");
      expect(within(card).getByTestId("workflow-stage-label-analysis").textContent).toBe(
        "Analysis",
      );
      expect(within(card).getByTestId("workflow-stage-label-redesign").textContent).toBe(
        "Redesign",
      );
      expect(within(card).getByTestId("workflow-stage-label-estimate").textContent).toBe(
        "Estimate",
      );
      expect(within(card).queryByTestId("workflow-stage-list")).toBeNull();
      expect(within(card).queryByTestId("workflow-continue-cta")).toBeNull();
    }
    expect(screen.queryAllByTestId("workflow-continue-cta")).toHaveLength(0);
    expect(screen.getAllByTestId("open-overview")).toHaveLength(2);
  });
});
