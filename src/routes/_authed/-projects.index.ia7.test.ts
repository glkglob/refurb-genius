/**
 * IA-7 / IA-7-R1 — Projects index + New Analysis entry contracts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "projects.index.tsx"), "utf8");
const SIDEBAR = readFileSync(join(__dirname, "../../components/Sidebar.tsx"), "utf8");
const ANALYZE = readFileSync(join(__dirname, "analyze.tsx"), "utf8");
const STUDIES = readFileSync(join(__dirname, "studies.tsx"), "utf8");
const GLOBAL_NAV = readFileSync(join(__dirname, "../../features/navigation/globalNav.ts"), "utf8");
const WORKSPACE = readFileSync(join(__dirname, "studies_.workspace.tsx"), "utf8");

describe("IA-7 Projects index + nav contracts", () => {
  it("registers /projects index route", () => {
    expect(SRC).toMatch(/createFileRoute\(\s*["']\/_authed\/projects\/["']/);
    expect(SRC).toMatch(/useProjects/);
    expect(SRC).toMatch(/ProjectContinuationCard/);
  });

  it("Sidebar uses shared GLOBAL_NAV_ITEMS and product-area active helper", () => {
    expect(SIDEBAR).toMatch(/GLOBAL_NAV_ITEMS/);
    expect(SIDEBAR).toMatch(/isGlobalNavItemActive/);
    expect(SIDEBAR).toMatch(/@\/features\/navigation/);
    expect(SIDEBAR).not.toMatch(/to:\s*["']\/studies["']/);
    expect(SIDEBAR).not.toMatch(/label:\s*["']Studies["']/);
    expect(SIDEBAR).not.toMatch(/label:\s*["']New Study["']/);
  });

  it("New Analysis global href is /analyze", () => {
    expect(GLOBAL_NAV).toMatch(/id:\s*["']new_analysis["']/);
    expect(GLOBAL_NAV).toMatch(/to:\s*["']\/analyze["']/);
    expect(GLOBAL_NAV).toMatch(/path === ["']\/analyze["']/);
  });

  it("/analyze is canonical project-entry (NewProjectEntry), not feasibility workspace", () => {
    expect(ANALYZE).toMatch(/NewProjectEntry/);
    expect(ANALYZE).toMatch(/createFileRoute\(\s*["']\/_authed\/analyze["']/);
    expect(ANALYZE).not.toMatch(/useFeasibilityOrchestrator/);
    expect(ANALYZE).not.toMatch(/Feasibility workspace/);
  });

  it("feasibility workspace lives under demoted /studies/workspace", () => {
    expect(WORKSPACE).toMatch(/createFileRoute\(\s*["']\/_authed\/studies_\/workspace["']/);
    expect(WORKSPACE).toMatch(/useFeasibilityOrchestrator/);
  });

  it("Studies surface points users toward Projects and New Analysis", () => {
    expect(STUDIES).toMatch(/Projects is the canonical/);
    expect(STUDIES).toMatch(/to=["']\/projects["']/);
    expect(STUDIES).toMatch(/to=["']\/analyze["']/);
  });

  it("Projects index New Analysis CTAs target /analyze", () => {
    expect(SRC).toMatch(/to=["']\/analyze["']/);
  });
});
