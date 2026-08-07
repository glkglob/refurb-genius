/**
 * IA-1-R1 — Analysis shell continuity.
 *
 * Source-structure tests: every project-aware Analysis render path must compose
 * ProjectWorkflowShell. Bare AppLayout is only allowed when project identity
 * is unavailable (initial load / load failure).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(
  join(process.cwd(), "src/routes/_authed/projects.$id.analysis.tsx"),
  "utf8",
);

function blockAfter(marker: string, nextMarker: string): string {
  const start = SRC.indexOf(marker);
  expect(start, `missing marker: ${marker}`).toBeGreaterThanOrEqual(0);
  const from = start + marker.length;
  const end = SRC.indexOf(nextMarker, from);
  expect(end, `missing next marker: ${nextMarker}`).toBeGreaterThan(start);
  return SRC.slice(start, end);
}

describe("IA-1-R1 Analysis shell continuity", () => {
  it("imports ProjectWorkflowShell from projects public API", () => {
    expect(SRC).toMatch(/ProjectWorkflowShell/);
    expect(SRC).toMatch(/from ["']@\/features\/projects["']/);
  });

  it("defines analysisShell helper wrapping ProjectWorkflowShell", () => {
    expect(SRC).toMatch(/const analysisShell\s*=/);
    expect(SRC).toMatch(/<ProjectWorkflowShell/);
  });

  it("uses shell for no_photos state content", () => {
    const block = blockAfter('if (uiState === "no_photos")', 'if (uiState === "stale_mock")');
    expect(block).toMatch(/analysisShell/);
    expect(block).toMatch(/NO PHOTOS TO ANALYSE/);
    expect(block).not.toMatch(/<AppLayout/);
  });

  it("uses shell for stale_mock state content", () => {
    const block = blockAfter(
      'if (uiState === "stale_mock")',
      'if (uiState === "loading" || analysing)',
    );
    expect(block).toMatch(/analysisShell/);
    expect(block).toMatch(/not based on the current project photos/);
    expect(block).not.toMatch(/<AppLayout/);
  });

  it("uses shell for analysis loading state when project exists", () => {
    const block = blockAfter(
      'if (uiState === "loading" || analysing)',
      'if (uiState === "error" && results.length === 0)',
    );
    expect(block).toMatch(/analysisShell/);
    expect(block).toMatch(/Running photo analysis/);
    expect(block).not.toMatch(/<AppLayout/);
  });

  it("uses shell for analysis error state when project exists", () => {
    const start = SRC.indexOf('if (uiState === "error" && results.length === 0)');
    expect(start).toBeGreaterThanOrEqual(0);
    // Error state is the last early-return before ready path subtitle.
    const end = SRC.indexOf("Room-by-room condition assessment", start);
    expect(end).toBeGreaterThan(start);
    const block = SRC.slice(start, end);
    expect(block).toMatch(/analysisShell/);
    expect(block).toMatch(/Analysis failed/);
    expect(block).not.toMatch(/<AppLayout/);
  });

  it("keeps ready path inside ProjectWorkflowShell", () => {
    expect(SRC).toMatch(/Room-by-room condition assessment/);
    expect(SRC).toMatch(/Continue to Redesign/);
    expect(SRC).toMatch(/ProjectWorkflowShell/);
  });

  it("preserves five-stage model via shell (no independent three-stage list)", () => {
    expect(SRC).not.toMatch(/label:\s*["']Upload["']/);
    expect(SRC).not.toMatch(/id:\s*["']upload["']\s*,\s*label:\s*["']Upload["']/);
  });

  it("does not introduce a first-class /redesign route", () => {
    expect(SRC).toMatch(/focus:\s*["']redesign["']/);
    expect(SRC).not.toMatch(/to:\s*["']\/projects\/\$id\/redesign["']/);
    expect(SRC).not.toMatch(/projects\.\$id\.redesign/);
  });

  it("only allows bare AppLayout when project identity is unavailable", () => {
    expect(SRC).toMatch(/if \(projectError\)/);
    expect(SRC).toMatch(/\(projectLoading \|\| photosLoading\) && !project/);
    const opens = SRC.match(/<AppLayout\b/g) ?? [];
    expect(opens.length).toBe(2);
  });

  it("preserves existing recovery actions for empty and stale states", () => {
    expect(SRC).toMatch(/Upload project photos/);
    expect(SRC).toMatch(/Analyse uploaded photos/);
    expect(SRC).toMatch(/runFreshAnalysis/);
  });
});
