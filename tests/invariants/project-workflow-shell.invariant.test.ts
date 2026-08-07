/**
 * IA-1 invariant: project workflow presentation stays on the locked five-stage
 * journey. Prevents reintroduction of an independent three-stage
 * Upload → Analyse → Estimate workflow authority.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("IA-1 domain defines exactly five locked stages in order", () => {
  const src = read("src/features/projects/domain/workflowStages.ts");
  assert.match(src, /Photos → Analysis → Redesign → Estimate → Export/);
  assert.match(src, /"photos"/);
  assert.match(src, /"analysis"/);
  assert.match(src, /"redesign"/);
  assert.match(src, /"estimate"/);
  assert.match(src, /"export"/);
  assert.match(src, /PROJECT_OVERVIEW_IS_WORKFLOW_STAGE = false/);
});

test("IA-1 pipeline checklist adapter does not reintroduce three-stage authority", () => {
  const src = read("src/components/pipeline-checklist.ts");
  assert.match(src, /buildProjectWorkflowStages/);
  assert.match(src, /Photos/);
  assert.match(src, /Redesign/);
  assert.match(src, /Export/);
  // Must not define a closed three-step id union as the only authority.
  assert.doesNotMatch(src, /export type PipelineStepId = "upload" \| "analyse" \| "estimate"/);
});

test("IA-4 first-class Redesign route exists under Projects", () => {
  assert.equal(
    existsSync(join(ROOT, "src/routes/_authed/projects.$id.redesign.tsx")),
    true,
    "IA-4 owns /projects/$id/redesign",
  );
});

test("IA-1 project workflow shell is exported from projects feature public API", () => {
  const src = read("src/features/projects/index.ts");
  assert.match(src, /ProjectWorkflowShell/);
  assert.match(src, /buildProjectWorkflowStages/);
  assert.match(src, /PROJECT_WORKFLOW_STAGES/);
});

test("upload and analysis routes consume shared shell / five-stage model", () => {
  const upload = read("src/routes/_authed/projects.$id.upload.tsx");
  const analysis = read("src/routes/_authed/projects.$id.analysis.tsx");
  assert.match(upload, /ProjectWorkflowShell/);
  assert.match(analysis, /ProjectWorkflowShell/);
  // Routes must not rebuild an independent three-step pipeline array.
  assert.doesNotMatch(upload, /label:\s*["']Upload["']/);
  assert.doesNotMatch(analysis, /id:\s*["']upload["']\s*,\s*label:\s*["']Upload["']/);
});

test("IA-1-R1 — Analysis early states use ProjectWorkflowShell when project exists", () => {
  const analysis = read("src/routes/_authed/projects.$id.analysis.tsx");
  // Helper used for all project-aware states (no_photos, stale, loading, error, ready).
  assert.match(analysis, /analysisShell/);
  assert.match(analysis, /uiState === ["']no_photos["']/);
  assert.match(analysis, /uiState === ["']stale_mock["']/);
  // Bare AppLayout only for identity-unavailable paths.
  assert.match(analysis, /projectError/);
  assert.match(analysis, /!project/);
  const appLayoutOpens = analysis.match(/<AppLayout\b/g) ?? [];
  assert.equal(
    appLayoutOpens.length,
    2,
    "Analysis must only use bare AppLayout for projectError and pre-identity loading",
  );
});
