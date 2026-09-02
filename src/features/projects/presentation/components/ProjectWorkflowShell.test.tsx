/**
 * IA-8-VR-R1 — customer-facing shell copy (no internal architecture language).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ProjectWorkflowShell } from "./ProjectWorkflowShell";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({
    children,
    title,
    subtitle,
  }: {
    children: ReactNode;
    title?: string;
    subtitle?: string;
  }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </div>
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock("./ProjectStageNav", () => ({
  ProjectStageNav: () => <nav data-testid="project-stage-nav" />,
}));

vi.mock("./MobileStickyNextAction", () => ({
  MobileStickyNextAction: () => <div data-testid="mobile-sticky-next-action-bar" />,
}));

const project = {
  id: "p1",
  name: "Test Project",
  address: "1 High St",
  postcode: "E1 1AA",
  property_type: "Terraced",
};

describe("ProjectWorkflowShell customer copy (IA-8-VR-R1)", () => {
  it("does not expose internal architecture language on Overview", () => {
    render(
      <ProjectWorkflowShell
        project={project}
        route={{ surface: "overview" }}
        progress={{
          photosDone: false,
          analysisDone: false,
          estimateDone: false,
          reportDone: false,
          photoCount: 0,
        }}
      >
        <div>content</div>
      </ProjectWorkflowShell>,
    );
    expect(screen.queryByText(/not a workflow stage/i)).toBeNull();
    expect(screen.queryByText(/Overview is the project home/i)).toBeNull();
    expect(screen.getByTestId("overview-workflow-hint").textContent).toMatch(
      /Track progress and continue your refurbishment/i,
    );
  });

  it("source has no residual customer-facing architecture sentences", () => {
    const src = readFileSync(join(__dirname, "ProjectWorkflowShell.tsx"), "utf8");
    expect(src).not.toMatch(/Overview is the project home — not a workflow stage/);
    expect(src).not.toMatch(/Scope is not a separate journey stage/);
  });

  it("reserves AppLayout footer space when a sticky next action is present", () => {
    const src = readFileSync(join(__dirname, "ProjectWorkflowShell.tsx"), "utf8");
    expect(src).toMatch(/mobileBottomReserve=\{Boolean\(stickyNextAction\)\}/);
  });
});
