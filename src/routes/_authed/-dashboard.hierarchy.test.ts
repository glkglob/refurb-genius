/**
 * Dashboard Home hierarchy — Brief then Board, no commercial or featured blocks.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "dashboard.tsx"), "utf8");

describe("Dashboard Home hierarchy", () => {
  it("uses Home/Dashboard heading and Project Brief then Workflow Board", () => {
    expect(SRC).toMatch(/lg:hidden">Home</);
    expect(SRC).toMatch(/hidden lg:inline">Dashboard</);
    expect(SRC).toMatch(/ProjectBrief/);
    expect(SRC).toMatch(/WorkflowBoard/);
    expect(SRC.indexOf("ProjectBrief")).toBeLessThan(SRC.indexOf("WorkflowBoard"));
  });

  it("has one New Analysis action and an in-page Deal Copilot path", () => {
    expect(SRC).toMatch(/data-testid="dashboard-new-analysis"/);
    expect(SRC.match(/data-testid="dashboard-new-analysis"/g)?.length).toBe(1);
    expect(SRC).toMatch(/showMobileTopBar=\{false\}/);
    expect(SRC).not.toMatch(/showDealCopilotRail/);
    expect(SRC).toMatch(/to="\/deal-copilot"/);
    expect(SRC).not.toMatch(/DealChat/);
    expect(SRC).not.toMatch(/DealCopilotRail/);
  });

  it("does not own trades, featured projects, or My projects", () => {
    expect(SRC).not.toMatch(/My projects/);
    expect(SRC).not.toMatch(/Continue where you left off/);
    expect(SRC).not.toMatch(/Other projects/);
    expect(SRC).not.toMatch(/ProjectContinuationCard/);
    expect(SRC).not.toMatch(/layout="featured"/);
    expect(SRC).not.toMatch(/listCurrentUserTradesJobs/);
    expect(SRC).not.toMatch(/useOnboardingGoalSelection/);
  });

  it("does not use five-stage hook or list progress flags", () => {
    expect(SRC).not.toMatch(/useProjectFiveStageWorkflow/);
    expect(SRC).not.toMatch(/photos_done/);
    expect(SRC).not.toMatch(/analysis_done/);
    expect(SRC).not.toMatch(/estimate_done/);
    expect(SRC).not.toMatch(/report_done/);
    expect(SRC).toMatch(/useDashboardProjectSummaries/);
  });
});
