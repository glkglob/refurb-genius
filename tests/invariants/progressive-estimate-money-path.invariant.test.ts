/**
 * Progressive estimate money-path architecture invariant (L1 + L2).
 *
 * Ensures the progressive L1/L2 path keeps financial authority in
 * @repo/services and does not compute money in presentation or the route.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

function read(rel: string): string {
  const full = join(ROOT, rel);
  assert.ok(existsSync(full), `missing ${rel}`);
  return readFileSync(full, "utf8");
}

const L1_USE_CASE = "src/features/estimate/application/runL1Estimate.ts";
const L2_USE_CASE = "src/features/estimate/application/runL2Estimate.ts";
const FORM = "src/features/estimate/presentation/components/L1EstimateForm.tsx";
const L2_FIELDS = "src/features/estimate/presentation/components/L2DetailsFields.tsx";
const SUMMARY = "src/features/estimate/presentation/components/CostSummary.tsx";
const ROUTE = "src/routes/_authed/estimate.instant.tsx";
const SOURCE = "src/features/estimate/domain/estimateSource.ts";
const L1_POLICY = "src/features/estimate/domain/l1Policy.ts";
const L2_POLICY = "src/features/estimate/domain/l2Policy.ts";
const PRESENTATION_BARREL = "src/features/estimate/presentation/index.ts";

// ── L1 use-case ────────────────────────────────────────────────────────────

test("runL1Estimate calls runPricingEngine and pins engine source + low confidence", () => {
  const src = read(L1_USE_CASE);
  assert.match(src, /runPricingEngine/, `${L1_USE_CASE} must call runPricingEngine`);
  assert.match(src, /source:\s*"engine"/, `${L1_USE_CASE} must set source "engine"`);
  assert.match(
    src,
    /displayConfidence:\s*"low"/,
    `${L1_USE_CASE} must force displayConfidence low`,
  );
  assert.doesNotMatch(src, /\brunL2Estimate\(/, `${L1_USE_CASE} must not call runL2Estimate`);
  assert.doesNotMatch(src, /mid_total\s*[:=]\s*\d+/, `${L1_USE_CASE} must not hard-code mid_total`);
  assert.doesNotMatch(
    src,
    /export type EstimateSource\s*=/,
    `${L1_USE_CASE} must not redeclare EstimateSource`,
  );
});

// ── L2 use-case ────────────────────────────────────────────────────────────

test("runL2Estimate calls runPricingEngine with L2 policy and engine source", () => {
  const src = read(L2_USE_CASE);
  assert.match(src, /runPricingEngine/, `${L2_USE_CASE} must call runPricingEngine`);
  assert.match(src, /resolveL2Inputs/, `${L2_USE_CASE} must use resolveL2Inputs`);
  assert.match(
    src,
    /resolveL2DisplayConfidence/,
    `${L2_USE_CASE} must use resolveL2DisplayConfidence`,
  );
  assert.match(src, /source:\s*"engine"/, `${L2_USE_CASE} must set source "engine"`);
  assert.doesNotMatch(
    src,
    /\brunL1Estimate\(|import\s*\{[^}]*\brunL1Estimate\b/,
    `${L2_USE_CASE} must not call or import runL1Estimate`,
  );
  assert.doesNotMatch(src, /mid_total\s*[:=]\s*\d+/, `${L2_USE_CASE} must not hard-code mid_total`);
  assert.doesNotMatch(
    src,
    /export type EstimateSource\s*=/,
    `${L2_USE_CASE} must not redeclare EstimateSource`,
  );
});

test("runL2Estimate displayConfidence is low|medium only (never high / non-engine sources)", () => {
  const src = read(L2_USE_CASE);
  assert.match(
    src,
    /displayConfidence:\s*"low"\s*\|\s*"medium"/,
    `${L2_USE_CASE} must type displayConfidence as low | medium`,
  );
  assert.doesNotMatch(
    src,
    /return\s+["']high["']/,
    `${L2_USE_CASE} must not return "high" display confidence`,
  );
  assert.doesNotMatch(
    src,
    /source:\s*["'](?:ai-assisted|fallback|mock)["']/,
    `${L2_USE_CASE} must not pin non-engine sources`,
  );
});

test("L2 policy owns confidence rules without money math", () => {
  const policy = read(L2_POLICY);
  assert.match(policy, /resolveL2DisplayConfidence/);
  assert.match(policy, /resolveL2Inputs/);
  assert.doesNotMatch(
    policy,
    /\brunPricingEngine\s*\(/,
    `${L2_POLICY} must not call runPricingEngine`,
  );
  assert.doesNotMatch(policy, /mid_total/, `${L2_POLICY} must not reference mid_total`);
  assert.doesNotMatch(
    policy,
    /return\s+["']high["']/,
    `${L2_POLICY} must never return high display confidence`,
  );
});

// ── Presentation ───────────────────────────────────────────────────────────

test("progressive form uses L1/L2 use-cases and does not compute money", () => {
  const form = read(FORM);
  assert.match(form, /runL1Estimate/, `${FORM} must reference runL1Estimate`);
  assert.match(form, /runL2Estimate/, `${FORM} must reference runL2Estimate`);
  assert.doesNotMatch(form, /runPricingEngine/, `${FORM} must not call runPricingEngine`);
  assert.doesNotMatch(form, /@repo\/services/, `${FORM} must not import @repo/services`);
  assert.doesNotMatch(
    form,
    /CATEGORY_BASE|REGION_MULTIPLIERS|FINISH_MULTIPLIERS/,
    `${FORM} must not import pricing tables`,
  );
  assert.doesNotMatch(form, /mid_total\s*=/, `${FORM} must not assign mid_total`);
  assert.doesNotMatch(form, /low_total\s*=/, `${FORM} must not assign low_total`);
  assert.doesNotMatch(form, /high_total\s*=/, `${FORM} must not assign high_total`);
});

test("L2DetailsFields is controlled presentation only (no estimate execution)", () => {
  const src = read(L2_FIELDS);
  assert.doesNotMatch(src, /runPricingEngine/, `${L2_FIELDS} must not call runPricingEngine`);
  assert.doesNotMatch(src, /runL1Estimate/, `${L2_FIELDS} must not call runL1Estimate`);
  assert.doesNotMatch(src, /runL2Estimate/, `${L2_FIELDS} must not call runL2Estimate`);
  assert.doesNotMatch(
    src,
    /from\s+["']\.\.\/\.\.\/application/,
    `${L2_FIELDS} must not import application modules`,
  );
  assert.doesNotMatch(src, /@repo\/services/, `${L2_FIELDS} must not import @repo/services`);
  assert.doesNotMatch(src, /mid_total|low_total|high_total/, `${L2_FIELDS} must not touch totals`);
  assert.match(
    src,
    /ESTIMATE_CATEGORIES|L2_FINISH_OPTIONS/,
    `${L2_FIELDS} must use canonical category/finish surfaces`,
  );
});

test("CostSummary remains presentation-only", () => {
  const summary = read(SUMMARY);
  assert.doesNotMatch(summary, /runPricingEngine/, `${SUMMARY} must not call runPricingEngine`);
  assert.doesNotMatch(summary, /@repo\/services/, `${SUMMARY} must not import @repo/services`);
  assert.doesNotMatch(
    summary,
    /mid_total\s*\+|low_total\s*\+|high_total\s*\+/,
    `${SUMMARY} must not compute totals`,
  );
  assert.doesNotMatch(
    summary,
    /export type CostSummarySource/,
    `${SUMMARY} must not redeclare CostSummarySource`,
  );
});

test("L2DetailsFields is not exported from the presentation public barrel", () => {
  const barrel = read(PRESENTATION_BARREL);
  assert.doesNotMatch(
    barrel,
    /L2DetailsFields/,
    `${PRESENTATION_BARREL} must keep L2DetailsFields private`,
  );
  assert.match(barrel, /L1EstimateForm/, `${PRESENTATION_BARREL} must export L1EstimateForm`);
  assert.match(barrel, /CostSummary/, `${PRESENTATION_BARREL} must export CostSummary`);
});

// ── Route ──────────────────────────────────────────────────────────────────

test("authenticated progressive route imports only the feature public API", () => {
  const route = read(ROUTE);
  assert.match(
    route,
    /from\s+["']@\/features\/estimate["']/,
    `${ROUTE} must import from @/features/estimate`,
  );
  assert.doesNotMatch(route, /\/domain\//, `${ROUTE} must not deep-import domain`);
  assert.doesNotMatch(route, /\/application\//, `${ROUTE} must not deep-import application`);
  assert.doesNotMatch(route, /\/presentation\//, `${ROUTE} must not deep-import presentation`);
  assert.match(
    route,
    /createFileRoute\(\s*["']\/_authed\/estimate\/instant["']/,
    `${ROUTE} must register /_authed/estimate/instant`,
  );
  assert.doesNotMatch(route, /runPricingEngine/, `${ROUTE} must not call runPricingEngine`);
  assert.doesNotMatch(route, /runL1Estimate/, `${ROUTE} must not call runL1Estimate directly`);
  assert.doesNotMatch(route, /runL2Estimate/, `${ROUTE} must not call runL2Estimate directly`);
});

// ── UI package boundary ────────────────────────────────────────────────────

test("progressive presentation files do not import @repo/ui/lib/utils", () => {
  for (const rel of [FORM, SUMMARY, L2_FIELDS]) {
    const src = read(rel);
    assert.doesNotMatch(src, /@repo\/ui\/lib\/utils/, `${rel} must not import @repo/ui/lib/utils`);
  }
});

// ── Canonical source + L1 policy honesty ───────────────────────────────────

test("canonical EstimateSource lives only in domain estimateSource", () => {
  const source = read(SOURCE);
  assert.match(source, /export const ESTIMATE_SOURCES/);
  assert.match(source, /export type EstimateSource/);

  for (const rel of [L1_USE_CASE, L2_USE_CASE, SUMMARY]) {
    const src = read(rel);
    assert.doesNotMatch(
      src,
      /export type EstimateSource\s*=/,
      `${rel} must not redeclare EstimateSource`,
    );
  }
  const summary = read(SUMMARY);
  assert.doesNotMatch(
    summary,
    /export type CostSummarySource/,
    "presentation must not export CostSummarySource",
  );
});

test("L1 policy uses resolvePostcodeRegion for honest mapping", () => {
  const policy = read(L1_POLICY);
  assert.match(policy, /resolvePostcodeRegion/);
  assert.doesNotMatch(
    policy,
    /function extractPostcodeArea/,
    "policy must not keep a local extractPostcodeArea",
  );
});
