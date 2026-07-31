#!/usr/bin/env node
/**
 * Ticket 4C2B — deterministic database-types surface verifier.
 *
 * Full type-file regeneration from local migrations does not reproduce the
 * committed `packages/supabase/src/database.types.ts` because the committed
 * file still contains remote-only / pre-migration tables (scope_analyses*,
 * analysis_jobs). That baseline debt is tracked separately.
 *
 * This script guards the 4C2B surface only:
 *   - estimates.pricing_authority
 *   - estimates.pricing_policy_version
 *   - estimates.catalog_revision
 *   - estimate_authority_idempotency (Row columns)
 *   - persist_category_engine_estimate (Args)
 *
 * Modes:
 *   node scripts/verify-4c2b-database-types.mjs
 *     → validate committed types against the expected 4C2B contract
 *     → if local Supabase is up, also generate and compare surfaces
 *
 *   node scripts/verify-4c2b-database-types.mjs --require-generate
 *     → fail if local generation cannot run
 *
 *   node scripts/verify-4c2b-database-types.mjs --committed-only
 *     → skip generation entirely (CI-friendly)
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMMITTED = join(ROOT, "packages/supabase/src/database.types.ts");
const TMP_DIR = join(ROOT, ".tmp/types");
const GENERATED = join(TMP_DIR, "database.types.generated.ts");

const EXPECTED_ESTIMATE_COLS = {
  pricing_authority: "string",
  pricing_policy_version: "string | null",
  catalog_revision: "string | null",
};

const EXPECTED_IDEMPOTENCY_ROW = {
  completed_at: "string | null",
  created_at: "string",
  id: "string",
  idempotency_key: "string",
  operation_status: "string",
  payload_hash: "string",
  pricing_authority: "string",
  project_id: "string",
  resulting_estimate_id: "string | null",
};

const EXPECTED_RPC_ARGS = {
  p_condition_level: "string",
  p_contingency: "number",
  p_expected_owner_id: "string",
  p_finish_level: "string",
  p_high_total: "number",
  p_idempotency_key: "string",
  p_items: "Json",
  p_labour_total: "number",
  p_low_total: "number",
  p_materials_total: "number",
  p_mid_total: "number",
  p_payload_hash: "string",
  p_pricing_policy_version: "string",
  p_project_id: "string",
  p_region: "string",
  p_subtotal: "number",
  p_timeline_weeks: "number",
  p_vat_amount: "number",
};

const args = new Set(process.argv.slice(2));
const requireGenerate = args.has("--require-generate");
const committedOnly = args.has("--committed-only");

/**
 * @param {string} source
 * @param {string} tableName
 * @returns {Record<string, string> | null}
 */
function extractTableRow(source, tableName) {
  const re = new RegExp(`${tableName}:\\s*\\{[\\s\\S]*?Row:\\s*\\{([\\s\\S]*?)\\n\\s{8}\\}`);
  const match = source.match(re);
  if (!match) return null;
  /** @type {Record<string, string>} */
  const cols = {};
  for (const m of match[1].matchAll(/^\s*([a-z_]+):\s*([^;\n]+)/gm)) {
    cols[m[1]] = m[2].trim();
  }
  return cols;
}

/**
 * @param {string} source
 * @returns {Record<string, string> | null}
 */
function extractRpcArgs(source) {
  const match = source.match(
    /persist_category_engine_estimate:\s*\{[\s\S]*?Args:\s*\{([\s\S]*?)\n\s{8}\}/,
  );
  if (!match) return null;
  /** @type {Record<string, string>} */
  const cols = {};
  for (const m of match[1].matchAll(/^\s*([a-z_]+):\s*([^;\n]+)/gm)) {
    cols[m[1]] = m[2].trim();
  }
  return cols;
}

/**
 * @param {string} label
 * @param {string} source
 */
function extractSurface(label, source) {
  const estimatesRow = extractTableRow(source, "estimates");
  const idempRow = extractTableRow(source, "estimate_authority_idempotency");
  const rpcArgs = extractRpcArgs(source);
  if (!estimatesRow) {
    throw new Error(`${label}: estimates table not found`);
  }
  if (!idempRow) {
    throw new Error(`${label}: estimate_authority_idempotency table not found`);
  }
  if (!rpcArgs) {
    throw new Error(`${label}: persist_category_engine_estimate RPC not found`);
  }
  /** @type {Record<string, string>} */
  const estimateCols = {};
  for (const key of Object.keys(EXPECTED_ESTIMATE_COLS)) {
    if (!(key in estimatesRow)) {
      throw new Error(`${label}: estimates.${key} missing`);
    }
    estimateCols[key] = estimatesRow[key];
  }
  return { estimateCols, idempRow, rpcArgs };
}

/**
 * @param {string} label
 * @param {Record<string, string>} actual
 * @param {Record<string, string>} expected
 * @param {string} prefix
 */
function assertExactMap(label, actual, expected, prefix) {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(
      `${label}: ${prefix} key mismatch\n  actual:   ${actualKeys.join(", ")}\n  expected: ${expectedKeys.join(", ")}`,
    );
  }
  for (const key of expectedKeys) {
    if (actual[key] !== expected[key]) {
      throw new Error(
        `${label}: ${prefix}.${key} type drift: got "${actual[key]}", expected "${expected[key]}"`,
      );
    }
  }
}

/**
 * @param {string} label
 * @param {string} source
 * @param {{ checkIdempExact?: boolean }} [opts]
 */
function assertSurfaceAgainstContract(label, source, opts = {}) {
  const surface = extractSurface(label, source);
  assertExactMap(label, surface.estimateCols, EXPECTED_ESTIMATE_COLS, "estimates");
  if (opts.checkIdempExact !== false) {
    assertExactMap(
      label,
      surface.idempRow,
      EXPECTED_IDEMPOTENCY_ROW,
      "estimate_authority_idempotency.Row",
    );
  }
  assertExactMap(
    label,
    surface.rpcArgs,
    EXPECTED_RPC_ARGS,
    "persist_category_engine_estimate.Args",
  );
  return surface;
}

/**
 * @param {ReturnType<typeof extractSurface>} a
 * @param {ReturnType<typeof extractSurface>} b
 * @param {string} left
 * @param {string} right
 */
function assertSurfacesEqual(a, b, left, right) {
  if (JSON.stringify(a.estimateCols) !== JSON.stringify(b.estimateCols)) {
    throw new Error(
      `estimate columns differ between ${left} and ${right}:\n  ${left}: ${JSON.stringify(a.estimateCols)}\n  ${right}: ${JSON.stringify(b.estimateCols)}`,
    );
  }
  if (JSON.stringify(a.idempRow) !== JSON.stringify(b.idempRow)) {
    throw new Error(`estimate_authority_idempotency Row differs between ${left} and ${right}`);
  }
  if (JSON.stringify(a.rpcArgs) !== JSON.stringify(b.rpcArgs)) {
    throw new Error(`persist_category_engine_estimate Args differ between ${left} and ${right}`);
  }
}

function tryGenerateLocalTypes() {
  mkdirSync(TMP_DIR, { recursive: true });
  try {
    // Prefer repository CLI; force local DB password so a remote SUPABASE_DB_PASSWORD
    // from developer .env does not break `gen types --local` (CLI 2.111.0+).
    const out = execFileSync(
      "pnpm",
      ["exec", "supabase", "gen", "types", "typescript", "--local", "--schema", "public"],
      {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, SUPABASE_DB_PASSWORD: "postgres" },
      },
    );
    writeFileSync(GENERATED, out, "utf8");
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (requireGenerate) {
      throw new Error(`type generation required but failed: ${message}`);
    }
    console.warn(`[verify-4c2b-types] local generation skipped: ${message}`);
    return false;
  }
}

function main() {
  if (!existsSync(COMMITTED)) {
    throw new Error(`committed types missing: ${COMMITTED}`);
  }
  const committedSource = readFileSync(COMMITTED, "utf8");
  const committedSurface = assertSurfaceAgainstContract("committed", committedSource);
  console.log("[verify-4c2b-types] committed 4C2B surface matches contract");

  if (committedOnly) {
    console.log("[verify-4c2b-types] --committed-only: generation skipped");
    return;
  }

  const generated = tryGenerateLocalTypes();
  if (!generated) {
    if (requireGenerate) {
      process.exit(1);
    }
    console.log(
      "[verify-4c2b-types] PASS (committed surface only; run with --require-generate when local Supabase is up)",
    );
    return;
  }

  const generatedSource = readFileSync(GENERATED, "utf8");
  const generatedSurface = assertSurfaceAgainstContract("generated", generatedSource);
  assertSurfacesEqual(generatedSurface, committedSurface, "generated", "committed");
  console.log(
    "[verify-4c2b-types] PASS (local generation 4C2B surface matches committed declarations)",
  );
}

try {
  main();
} catch (err) {
  console.error("[verify-4c2b-types] FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
