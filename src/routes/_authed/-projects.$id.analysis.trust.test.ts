/**
 * IA-8-VR-R1 — Analysis separates workflow completion from review quality.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "projects.$id.analysis.tsx"), "utf8");

describe("Analysis trust hierarchy (IA-8-VR-R1)", () => {
  it("presents workflow completion distinctly from review quality", () => {
    expect(SRC).toMatch(/analysis-trust-summary/);
    expect(SRC).toMatch(/analysis-workflow-status/);
    expect(SRC).toMatch(/Workflow:\s*Complete/);
    expect(SRC).toMatch(/analysis-review-quality/);
    expect(SRC).toMatch(/Review recommended/);
  });

  it("does not claim results are invalid when continuation is allowed", () => {
    expect(SRC).toMatch(/You can continue, but review these results before relying on them/);
    expect(SRC).toMatch(/for Scope or[\s\S]*pricing/);
  });

  it("does not map review quality into shell Needs attention flags", () => {
    // Shell flags still from currency only (IA-3-R1).
    expect(SRC).toMatch(/analysisShellFlagsFromCurrency/);
    expect(SRC).toMatch(/Fallback \/ low-confidence remain advisory/);
  });
});
