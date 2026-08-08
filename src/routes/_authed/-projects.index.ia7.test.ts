/**
 * IA-7 — Projects index is the canonical browse destination.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "projects.index.tsx"), "utf8");
const SIDEBAR = readFileSync(join(__dirname, "../../components/Sidebar.tsx"), "utf8");
const ANALYZE = readFileSync(join(__dirname, "analyze.tsx"), "utf8");
const STUDIES = readFileSync(join(__dirname, "studies.tsx"), "utf8");

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

  it("legacy /analyze offers project workflow continuation", () => {
    expect(ANALYZE).toMatch(/Continue in project Photos|analyze-continue-project-workflow/);
    expect(ANALYZE).toMatch(/\/projects\/\$id\/upload/);
  });

  it("Studies surface points users toward Projects", () => {
    expect(STUDIES).toMatch(/Projects is the canonical/);
    expect(STUDIES).toMatch(/to=["']\/projects["']/);
  });
});
