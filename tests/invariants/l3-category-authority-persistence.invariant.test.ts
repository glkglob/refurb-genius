/**
 * Ticket 4C2B — category authority persistence boundary invariants.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const ROUTE = "src/routes/_authed/projects.$id.estimate.tsx";
const INFRA_BARREL = "src/features/estimate/infrastructure/index.ts";
const SERVER_ADAPTER =
  "src/features/estimate/infrastructure/repositories/categoryAuthorityEstimate.repository.server.ts";
const BROWSER_REPO = "src/features/estimate/infrastructure/repositories/estimate.repository.ts";
const MIGRATION =
  "supabase/migrations/20260730120000_estimate_authority_persistence_foundation.sql";
const PRICING_ENGINE = "packages/services/src/pricing/pricingEngine.ts";

test("4C2B migration foundation exists", () => {
  assert.ok(existsSync(join(ROOT, MIGRATION)), "authority migration must exist");
  const sql = read(MIGRATION);
  assert.match(sql, /pricing_authority/);
  assert.match(sql, /estimate_authority_idempotency/);
  assert.match(sql, /persist_category_engine_estimate/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.persist_category_engine_estimate/);
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.persist_category_engine_estimate[\s\S]*TO service_role/,
  );
  assert.doesNotMatch(sql, /GRANT EXECUTE[\s\S]*TO authenticated/);
  assert.match(sql, /estimate_done = true/);
  assert.doesNotMatch(sql, /estimated_gdv\s*=/);
});

test("quick canonical route does not import or call browser saveProjectEstimate", () => {
  const text = read(ROUTE);
  assert.doesNotMatch(text, /saveProjectEstimate/);
  assert.match(text, /saveAuthorityCategoryEstimateServerFn/);
});

test("quick canonical save sends no totals or user ID", () => {
  const text = read(ROUTE);
  // Balanced extraction of the serverFn argument object.
  const start = text.indexOf("saveAuthorityCategoryEstimateServerFn({");
  assert.ok(start >= 0, "must call saveAuthorityCategoryEstimateServerFn");
  let depth = 0;
  let end = -1;
  for (let i = start + "saveAuthorityCategoryEstimateServerFn".length; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(" || ch === "{") depth++;
    else if (ch === ")" || ch === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  assert.ok(end > start, "must find balanced call end");
  const payload = text.slice(start, end);
  assert.match(payload, /selected_categories:\s*categories/);
  assert.match(payload, /property_size_sqm:\s*project\.size_sqm/);
  assert.doesNotMatch(payload, /\buserId\b/);
  assert.doesNotMatch(payload, /\bmid_total\b/);
  assert.doesNotMatch(payload, /\blabour_total\b/);
  assert.doesNotMatch(payload, /\bpricingAuthority\b/);
  // Money totals must not be sent as save inputs (response handling may mention totals).
  assert.doesNotMatch(payload, /inputs:\s*\{[^}]*\bsubtotal\b/);
});

test("manual/AI draft callbacks do not mark estimate_done", () => {
  const text = read(ROUTE);
  assert.doesNotMatch(
    text,
    /onSaved=\{\(\)\s*=>\s*\{[\s\S]*setStage\.mutate\(\{\s*id,\s*stage:\s*["']estimate["']/,
  );
  // No remaining setStage for estimate on this route
  assert.doesNotMatch(text, /useSetProjectStage/);
  assert.doesNotMatch(text, /stage:\s*["']estimate["']/);
});

test("authority server adapter is not exported from browser-safe barrel", () => {
  const barrel = read(INFRA_BARREL);
  assert.doesNotMatch(barrel, /categoryAuthorityEstimate/);
  assert.doesNotMatch(barrel, /persistCategoryEngineEstimate/);
  assert.ok(existsSync(join(ROOT, SERVER_ADAPTER)));
});

test("authority server module imports no browser Supabase client", () => {
  const text = read(SERVER_ADAPTER);
  assert.doesNotMatch(text, /@\/platform\/supabase\/browser/);
  assert.doesNotMatch(text, /from ["']@\/platform\/supabase["']/);
  assert.doesNotMatch(text, /from ["']@supabase\/supabase-js["']/);
  assert.match(text, /@\/platform\/supabase\/service\.server/);
  assert.match(text, /persist_category_engine_estimate/);
});

test("browser repository cannot set authority marker", () => {
  const text = read(BROWSER_REPO);
  assert.doesNotMatch(text, /pricing_authority\s*:/);
  assert.doesNotMatch(text, /pricing_policy_version\s*:/);
  assert.doesNotMatch(text, /catalog_revision\s*:/);
  assert.doesNotMatch(text, /category-engine/);
  assert.doesNotMatch(text, /measured-boq-engine/);
});

test("runPricingEngine remains canonical formula owner", () => {
  const engine = read(PRICING_ENGINE);
  assert.match(engine, /export function runPricingEngine/);
  assert.match(engine, /CATEGORY_BASE/);
  // Route still uses engine for preview
  assert.match(read(ROUTE), /runPricingEngine/);
});

test("no 4C2C/4C2D/4C2E/4C2F measured-BOQ catalogue or reader cutover work", () => {
  const serverAdapter = read(SERVER_ADAPTER);
  assert.doesNotMatch(serverAdapter, /persist_measured|measured-boq-engine/);
  assert.doesNotMatch(read(ROUTE), /canonicalEstimateByProject|estimateDraftByProject/);
  // Migration allows marker value for staged contract but creates no measured-BOQ RPC
  const sql = read(MIGRATION);
  assert.doesNotMatch(sql, /persist_measured/);
  assert.match(sql, /pricing_authority = 'category-engine'/);
});
