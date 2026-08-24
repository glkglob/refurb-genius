/**
 * Dashboard product hierarchy — project-first My projects, no commercial/trades blocks.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "dashboard.tsx"), "utf8");
const STAGES = readFileSync(
  join(__dirname, "../../features/projects/domain/workflowStages.ts"),
  "utf8",
);
const CARD = readFileSync(
  join(__dirname, "../../features/projects/presentation/components/ProjectContinuationCard.tsx"),
  "utf8",
);

describe("Dashboard product hierarchy", () => {
  it("renders project-first My projects with Continue and Other projects", () => {
    expect(SRC).toMatch(/My projects/);
    expect(SRC).toMatch(/data-testid="dashboard-projects-section"/);
    expect(SRC).toMatch(/Continue where you left off/);
    expect(SRC).toMatch(/Other projects/);
    expect(SRC).toMatch(/data-testid="dashboard-featured-project"/);
    expect(SRC).toMatch(/data-testid="dashboard-project-rows"/);
  });

  it("has one New Analysis action and no commercial statistics", () => {
    expect(SRC).toMatch(/data-testid="dashboard-new-analysis"/);
    expect(SRC.match(/data-testid="dashboard-new-analysis"/g)?.length).toBe(1);
    expect(SRC).not.toMatch(/dashboard-commercial-metrics/);
    expect(SRC).not.toMatch(/commercialStats/);
    expect(SRC).not.toMatch(/commercialEmpty/);
    expect(SRC).not.toMatch(/Trades activity/);
  });

  it("does not own trades, studies, or blocking onboarding", () => {
    expect(SRC).not.toMatch(/My trades jobs/);
    expect(SRC).not.toMatch(/Browse Trades Jobs/);
    expect(SRC).not.toMatch(/Post a Trades Job/);
    expect(SRC).not.toMatch(/listCurrentUserTradesJobs/);
    expect(SRC).not.toMatch(/dashboard-studies-secondary/);
    expect(SRC).not.toMatch(/useOnboardingGoalSelection/);
    expect(SRC).not.toMatch(/QuickActionCard/);
  });

  it("does not use legacy progress flags for featured selection", () => {
    expect(SRC).not.toMatch(/isProjectInProgress/);
    expect(SRC).not.toMatch(/photos_done/);
    expect(SRC).not.toMatch(/analysis_done/);
    expect(SRC).not.toMatch(/estimate_done/);
    expect(SRC).not.toMatch(/report_done/);
    expect(SRC).toMatch(/filtered\[0\]/);
  });

  it("keeps ProjectContinuationCard as next-action authority", () => {
    expect(SRC).toMatch(/ProjectContinuationCard/);
    expect(SRC).toMatch(/layout="featured"/);
    expect(SRC).not.toMatch(/resolveProjectNextAction/);
    expect(SRC).not.toMatch(/useProjectFiveStageWorkflow/);
    expect(CARD).toMatch(/resolveProjectNextAction/);
    expect(CARD).toMatch(/useProjectFiveStageWorkflow/);
  });

  it("five stages remain Photos, Analysis, Redesign, Estimate, Export", () => {
    expect(STAGES).toMatch(/label: "Photos"/);
    expect(STAGES).toMatch(/label: "Analysis"/);
    expect(STAGES).toMatch(/label: "Redesign"/);
    expect(STAGES).toMatch(/label: "Estimate"/);
    expect(STAGES).toMatch(/label: "Export"/);
    expect(STAGES).toMatch(/Photos → Analysis → Redesign → Estimate → Export/);
    expect(CARD).toMatch(/buildProjectWorkflowStages/);
  });
});
