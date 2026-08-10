/**
 * IA-8-VR-R1 — Dashboard prioritises refurb projects over empty commercial metrics.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "dashboard.tsx"), "utf8");

describe("Dashboard product hierarchy (IA-8-VR-R1)", () => {
  it("renders projects section before commercial metrics in the page tree", () => {
    // In the returned tree, projectsSection is mounted before commercialStats.
    const returnIdx = SRC.indexOf("return (");
    const tree = SRC.slice(returnIdx);
    const projectsIdx = tree.indexOf("{projectsSection}");
    const metricsIdx = tree.indexOf("{commercialStats}");
    expect(projectsIdx).toBeGreaterThan(-1);
    expect(metricsIdx).toBeGreaterThan(-1);
    expect(projectsIdx).toBeLessThan(metricsIdx);
    expect(tree).toMatch(/data-testid="dashboard-projects-section"/);
    expect(SRC).toMatch(/data-testid="dashboard-commercial-metrics"/);
  });

  it("compacts empty commercial metrics instead of full-height zero cards only", () => {
    expect(SRC).toMatch(/commercialEmpty/);
    expect(SRC).toMatch(/compact=\{commercialEmpty\}/);
    expect(SRC).toMatch(/Trades activity/);
  });

  it("orders core journey quick actions before trades job-board actions", () => {
    const newAnalysis = SRC.indexOf('label="New Analysis"');
    const createProject = SRC.indexOf('label="Create Project"');
    const postJob = SRC.indexOf('label="Post a Trades Job"');
    expect(newAnalysis).toBeGreaterThan(-1);
    expect(createProject).toBeGreaterThan(-1);
    expect(postJob).toBeGreaterThan(-1);
    expect(newAnalysis).toBeLessThan(createProject);
    expect(createProject).toBeLessThan(postJob);
  });

  it("PH-TRUTH: Studies remain accessible but secondary to the project workflow", () => {
    expect(SRC).toMatch(/data-testid="dashboard-studies-secondary"/);
    expect(SRC).toMatch(/Optional · Feasibility snapshots/);
    expect(SRC).toMatch(/to="\/studies"/);
    // Not a primary quick-action card
    expect(SRC).not.toMatch(/label="Saved Studies"/);
    const projectsIdx = SRC.indexOf('data-testid="dashboard-projects-section"');
    const studiesIdx = SRC.indexOf('data-testid="dashboard-studies-secondary"');
    expect(projectsIdx).toBeGreaterThan(-1);
    expect(studiesIdx).toBeGreaterThan(projectsIdx);
  });

  it("PH-TRUTH-R1: primary workflow copy remains Photos→Export", () => {
    expect(SRC).toMatch(/Photos, Analysis, Redesign, Estimate, Export/);
  });

  it("PH-TRUTH-R1: Study celebration cannot complete an Estimate/Export checklist label", () => {
    // done-state for the optional snapshot item is Study celebration only
    expect(SRC).toMatch(/done=\{hasCompletedFirstStudy\}/);
    expect(SRC).toMatch(/label="Optional: create a feasibility snapshot"/);
    // Forbidden pairing from PH-TRUTH candidate
    expect(SRC).not.toMatch(/Complete an estimate or export on a project/);
    // Must not invent estimate/export authority from Study state
    expect(SRC).not.toMatch(/done=\{hasCompletedFirstStudy\}[\s\S]{0,80}estimate or export/i);
  });
});
