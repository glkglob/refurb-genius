/**
 * L3 measured-BOQ money-path architecture invariant (Ticket 4C1 / 4C1A).
 *
 * Ensures the measured-BOQ service and reprice application wrapper keep
 * financial authority in @repo/services and do not persist or touch UI.
 *
 * Library amounts must come from a trusted catalogue dependency, not the
 * BOQ line payload. Presentation-owned builder calculations remain known
 * debt for Ticket 4C2; this invariant does not fail against unchanged builders.
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

const ENGINE = "packages/services/src/measured-boq/measuredBoqEngine.ts";
const ENGINE_INDEX = "packages/services/src/measured-boq/index.ts";
const SERVICES_INDEX = "packages/services/src/index.ts";
const REPRICE = "src/features/estimate/application/repriceMeasuredBoq.ts";
const APP_INDEX = "src/features/estimate/application/index.ts";

// ── Service ────────────────────────────────────────────────────────────────

test("measured-BOQ engine exists under packages/services and exports runMeasuredBoqEngine", () => {
  const src = read(ENGINE);
  assert.match(src, /export function runMeasuredBoqEngine/);
  assert.match(src, /export function resolveMeasuredBoqRate/);
  assert.match(src, /export function assessMeasuredBoqAuthority/);
  assert.match(src, /getRegionalMultiplier/);
  assert.match(src, /VAT_RATE/);
  assert.match(src, /CONTINGENCY_RATE/);
  assert.ok(existsSync(join(ROOT, ENGINE_INDEX)), "measured-boq index missing");
  assert.match(read(SERVICES_INDEX), /measured-boq/);
});

test("measured-BOQ engine has no React, repository or presentation imports", () => {
  const src = read(ENGINE);
  assert.doesNotMatch(src, /from\s+["']react["']/);
  assert.doesNotMatch(src, /@tanstack\/react/);
  assert.doesNotMatch(src, /from\s+["']@?\/?.*supabase/i);
  assert.doesNotMatch(src, /estimate\.repository/);
  assert.doesNotMatch(src, /features\/estimate\/presentation/);
  assert.doesNotMatch(src, /components\/EstimateBuilder/);
  assert.doesNotMatch(src, /components\/AIEstimateBuilder/);
});

test("MeasuredBoqEngineInput does not accept money totals or a library resolver", () => {
  const src = read(ENGINE);
  const inputBlock = src.match(/export type MeasuredBoqEngineInput\s*=\s*\{[\s\S]*?\n\};/);
  assert.ok(inputBlock, "MeasuredBoqEngineInput type missing");
  assert.doesNotMatch(inputBlock[0]!, /\bsubtotal\b/);
  assert.doesNotMatch(inputBlock[0]!, /\bcontingency\b/);
  assert.doesNotMatch(inputBlock[0]!, /\bmidTotal\b/);
  assert.doesNotMatch(inputBlock[0]!, /\bhighTotal\b/);
  assert.doesNotMatch(inputBlock[0]!, /\blowTotal\b/);
  assert.doesNotMatch(inputBlock[0]!, /\bdisplayConfidence\b/);
  assert.doesNotMatch(inputBlock[0]!, /resolveLibraryRate/);
  assert.doesNotMatch(inputBlock[0]!, /MeasuredBoqEngineDependencies/);
});

test("MeasuredBoqLibraryRate is identity-only (no caller baseUnitRate money)", () => {
  const src = read(ENGINE);
  const libBlock = src.match(/export type MeasuredBoqLibraryRate\s*=\s*\{[\s\S]*?\n\};/);
  assert.ok(libBlock, "MeasuredBoqLibraryRate type missing");
  assert.doesNotMatch(libBlock[0]!, /\bbaseUnitRate\b/);
  assert.doesNotMatch(libBlock[0]!, /\bcurrency\b/);
  assert.doesNotMatch(libBlock[0]!, /\bvatBasis\b/);
  assert.doesNotMatch(libBlock[0]!, /\bresolvedUnitRate\b/);
  assert.match(libBlock[0]!, /rateKey/);
  assert.match(libBlock[0]!, /catalogRevision/);
});

test("engine requires external resolveLibraryRate dependency", () => {
  const src = read(ENGINE);
  assert.match(src, /export type MeasuredBoqEngineDependencies/);
  assert.match(src, /resolveLibraryRate/);
  // Signatures accept dependencies as a separate parameter.
  assert.match(
    src,
    /export function runMeasuredBoqEngine\([\s\S]*?dependencies:\s*MeasuredBoqEngineDependencies/,
  );
  assert.match(
    src,
    /export function resolveMeasuredBoqRate\([\s\S]*?dependencies:\s*MeasuredBoqEngineDependencies/,
  );
  assert.match(src, /dependencies\.resolveLibraryRate/);
  // Non-empty strings alone are not library authority — catalogue lookup is required.
  assert.match(src, /No trusted library rate/);
});

test("measured-BOQ engine does not call calculateEstimateTotals", () => {
  const src = read(ENGINE);
  assert.doesNotMatch(src, /calculateEstimateTotals/);
});

test("measured-BOQ issue codes include distinct structural symbols", () => {
  const src = read(ENGINE);
  for (const code of [
    "MISSING_ROOM_ID",
    "MISSING_ROOM_NAME",
    "MISSING_LINE_ID",
    "INVALID_ITEM_NAME",
    "INVALID_ITEM_UNIT",
    "INVALID_COST_TYPE",
    "DUPLICATE_ROOM_ID",
    "DUPLICATE_LINE_ID",
    "EMPTY_ROOM",
    "NO_ROOMS",
  ]) {
    assert.match(src, new RegExp(`"${code}"`));
  }
});

// ── Application ────────────────────────────────────────────────────────────

test("repriceMeasuredBoq calls runMeasuredBoqEngine and pins engine source", () => {
  const src = read(REPRICE);
  assert.match(src, /runMeasuredBoqEngine/);
  assert.match(src, /source:\s*["']engine["']/);
  assert.match(src, /ai-assisted/);
  assert.match(src, /fallback/);
  assert.match(read(APP_INDEX), /repriceMeasuredBoq/);
});

test("repriceMeasuredBoq delegates library dependency and does not recompute money", () => {
  const src = read(REPRICE);
  assert.match(src, /RepriceMeasuredBoqDependencies/);
  assert.match(src, /runMeasuredBoqEngine\(\s*input\s*,\s*dependencies\s*\)/);
  assert.doesNotMatch(src, /from\s+["']@?\/?.*supabase/i);
  assert.doesNotMatch(src, /from\s+["']react["']/);
  assert.doesNotMatch(src, /\buseSave|\buseMutation|\buseQuery\b/);
  assert.doesNotMatch(src, /\bsaveAIEstimate\b|\bsaveProjectEstimate\b/);
  assert.doesNotMatch(src, /\bCONTINGENCY_RATE\b|\bVAT_RATE\b|\bMEASURED_BOQ_CONTINGENCY\b/);
  assert.doesNotMatch(src, /\*\s*0\.1|\*\s*0\.2/);
});
