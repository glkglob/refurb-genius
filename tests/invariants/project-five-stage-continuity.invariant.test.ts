/**
 * IA-5 invariant: five-stage continuity — Scope is not a sixth stage;
 * Estimate/Export provenance adapters and reconcile_scope contract.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

test("IA-5 migration stamps Scope/Estimate/Export provenance", () => {
  const mig = "supabase/migrations/20260808120000_ia5_five_stage_continuity_provenance.sql";
  assert.ok(existsSync(join(root, mig)), "IA-5 migration exists");
  const sql = read(mig);
  assert.match(sql, /analysis_identity/);
  assert.match(sql, /redesign_identity/);
  assert.match(sql, /input_scope_id/);
  assert.match(sql, /project_export_snapshots/);
  assert.match(sql, /bind_estimate_input_scope/);
});

test("IA-5 pure adapters exist and are exported", () => {
  assert.ok(existsSync(join(root, "src/features/projects/domain/scopeWorkflowAdapter.ts")));
  assert.ok(existsSync(join(root, "src/features/projects/domain/estimateWorkflowAdapter.ts")));
  assert.ok(existsSync(join(root, "src/features/projects/domain/exportWorkflowAdapter.ts")));
  assert.ok(existsSync(join(root, "src/features/projects/domain/composeProjectWorkflowState.ts")));
  const barrel = read("src/features/projects/domain/index.ts");
  assert.match(barrel, /scopeCurrencyFromEvidence/);
  assert.match(barrel, /estimateCurrencyFromEvidence/);
  assert.match(barrel, /exportCurrencyFromEvidence/);
  assert.match(barrel, /composeProjectWorkflowState/);
});

test("IA-5 resolver still uses Estimate stage for reconcile_scope", () => {
  const resolver = read("src/features/projects/domain/resolveProjectNextAction.ts");
  assert.match(resolver, /reconcile_scope/);
  assert.match(resolver, /stage: "estimate"/);
  assert.match(resolver, /surface: "estimate"/);
  assert.doesNotMatch(
    resolver,
    /surface: "scope"/,
    "primary continuation must not use /scope surface",
  );
});

test("IA-5 stage navigator has no Scope stage", () => {
  const stages = read("src/features/projects/domain/workflowStages.ts");
  assert.match(
    stages,
    /PROJECT_WORKFLOW_STAGE_IDS = \[[\s\S]*?"photos"[\s\S]*?"analysis"[\s\S]*?"redesign"[\s\S]*?"estimate"[\s\S]*?"export"[\s\S]*?\]/,
  );
  const idsBlock = stages.match(
    /export const PROJECT_WORKFLOW_STAGE_IDS = \[([\s\S]*?)\] as const/,
  );
  assert.ok(idsBlock, "stage ids block present");
  assert.doesNotMatch(idsBlock![1], /"scope"/, "Scope must not be a customer stage id");
});

test("IA-5 report does not complete Export on page visit", () => {
  const report = read("src/routes/_authed/projects.$id.report.tsx");
  assert.doesNotMatch(
    report,
    /setStage\.mutate\(\s*\{\s*id,\s*stage:\s*"report"/,
    "report_done must not be set on mount",
  );
  assert.match(report, /saveExportSnapshot/);
});

test("IA-5 estimate uses five-stage workflow and Review Scope", () => {
  const estimate = read("src/routes/_authed/projects.$id.estimate.tsx");
  assert.match(estimate, /useProjectFiveStageWorkflow/);
  assert.match(estimate, /Review Scope/);
  assert.match(estimate, /bindEstimateToScope/);
});

test("IA-5 scope stamps analysis and redesign identities", () => {
  const scope = read("src/routes/_authed/projects.$id.scope.tsx");
  assert.match(scope, /analysisIdentity/);
  assert.match(scope, /redesignIdentity/);
  assert.match(scope, /not a sixth journey stage/i);
});
