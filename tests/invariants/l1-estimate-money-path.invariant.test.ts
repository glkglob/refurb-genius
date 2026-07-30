/**
 * L1 estimate money-path architecture invariant.
 *
 * Ensures the progressive L1 path keeps financial authority in @repo/services
 * and does not compute money in presentation or the route.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

function read(rel: string): string {
  const full = join(ROOT, rel);
  assert.ok(existsSync(full), `missing ${rel}`);
  return readFileSync(full, "utf8");
}

const USE_CASE = "src/features/estimate/application/runL1Estimate.ts";
const FORM = "src/features/estimate/presentation/components/L1EstimateForm.tsx";
const SUMMARY = "src/features/estimate/presentation/components/CostSummary.tsx";
const ROUTE = "src/routes/_authed/estimate.instant.tsx";
const SOURCE = "src/features/estimate/domain/estimateSource.ts";
const POLICY = "src/features/estimate/domain/l1Policy.ts";

test("runL1Estimate calls runPricingEngine and pins engine source", () => {
  const src = read(USE_CASE);
  assert.match(src, /runPricingEngine/, `${USE_CASE} must call runPricingEngine`);
  assert.match(src, /source:\s*"engine"/, `${USE_CASE} must set source "engine"`);
  assert.match(src, /displayConfidence:\s*"low"/, `${USE_CASE} must force displayConfidence low`);
  assert.doesNotMatch(src, /mid_total\s*[:=]\s*\d+/, `${USE_CASE} must not hard-code mid_total`);
  assert.doesNotMatch(
    src,
    /export type EstimateSource\s*=/,
    `${USE_CASE} must not redeclare EstimateSource`,
  );
});

test("L1 presentation does not call runPricingEngine or compute totals", () => {
  const form = read(FORM);
  const summary = read(SUMMARY);
  assert.doesNotMatch(form, /runPricingEngine/, `${FORM} must not call runPricingEngine`);
  assert.doesNotMatch(summary, /runPricingEngine/, `${SUMMARY} must not call runPricingEngine`);
  assert.doesNotMatch(form, /mid_total\s*=/, `${FORM} must not assign mid_total`);
  assert.doesNotMatch(form, /low_total\s*=/, `${FORM} must not assign low_total`);
  assert.doesNotMatch(form, /high_total\s*=/, `${FORM} must not assign high_total`);
  assert.doesNotMatch(summary, /@repo\/services/, `${SUMMARY} must not import @repo/services`);
  assert.doesNotMatch(
    form,
    /CATEGORY_BASE|REGION_MULTIPLIERS|FINISH_MULTIPLIERS/,
    `${FORM} must not import pricing tables`,
  );
});

test("authenticated L1 route imports only the feature public API", () => {
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
});

test("L1 files do not import @repo/ui/lib/utils", () => {
  for (const rel of [FORM, SUMMARY]) {
    const src = read(rel);
    assert.doesNotMatch(src, /@repo\/ui\/lib\/utils/, `${rel} must not import @repo/ui/lib/utils`);
  }
});

test("canonical EstimateSource lives only in domain estimateSource", () => {
  const source = read(SOURCE);
  assert.match(source, /export const ESTIMATE_SOURCES/);
  assert.match(source, /export type EstimateSource/);

  const useCase = read(USE_CASE);
  const summary = read(SUMMARY);
  assert.doesNotMatch(
    useCase,
    /export type EstimateSource\s*=/,
    "application must not export EstimateSource",
  );
  assert.doesNotMatch(
    summary,
    /export type CostSummarySource/,
    "presentation must not export CostSummarySource",
  );
});

test("L1 policy uses resolvePostcodeRegion for honest mapping", () => {
  const policy = read(POLICY);
  assert.match(policy, /resolvePostcodeRegion/);
  assert.doesNotMatch(
    policy,
    /function extractPostcodeArea/,
    "policy must not keep a local extractPostcodeArea",
  );
});
