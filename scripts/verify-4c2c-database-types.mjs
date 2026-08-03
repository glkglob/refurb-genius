#!/usr/bin/env node
/**
 * Ticket 4C2C-B — deterministic database-types surface verifier for catalogue foundation.
 *
 * Does not attempt issue #90 full baseline repair.
 *
 * Modes:
 *   node scripts/verify-4c2c-database-types.mjs
 *   node scripts/verify-4c2c-database-types.mjs --require-generate
 *   node scripts/verify-4c2c-database-types.mjs --committed-only
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMMITTED = join(ROOT, "packages/supabase/src/database.types.ts");
const TMP_DIR = join(ROOT, ".tmp/types");
const GENERATED = join(TMP_DIR, "database.types.generated.ts");

const EXPECTED_ITEM_PROVENANCE = {
  rate_source: "string | null",
  rate_key: "string | null",
  catalog_revision: "string | null",
  base_unit_rate: "number | null",
  regional_multiplier: "number | null",
  resolved_unit_rate: "number | null",
};

// B2C1 additive revision provenance/lifecycle columns (migration
// 20260802060000_measured_boq_catalogue_persistence_foundation.sql) are
// required. Legacy-nullable columns remain nullable; production defaults false.
const EXPECTED_REVISION_ROW = {
  catalog_revision: "string",
  content_checksum: "string",
  created_at: "string",
  created_by: "string",
  currency: "string",
  effective_from: "string",
  entry_count: "number",
  id: "string",
  input_checksum: "string | null",
  licence_status: "string | null",
  normaliser_version: "string | null",
  production: "boolean",
  published_at: "string | null",
  published_by_id: "string | null",
  published_by_kind: "string | null",
  regional_basis: "string",
  release_notes: "string | null",
  retired_at: "string | null",
  retired_by_id: "string | null",
  retired_by_kind: "string | null",
  retirement_reason: "string | null",
  schema_version: "string",
  source_description: "string",
  source_id: "string | null",
  status: "string",
  updated_at: "string",
  vat_basis: "string",
};

const EXPECTED_ENTRY_ROW = {
  base_unit_rate: "number",
  catalog_revision: "string",
  cost_type: "string",
  created_at: "string",
  currency: "string",
  description: "string | null",
  display_name: "string",
  id: "string",
  rate_key: "string",
  replacement_rate_key: "string | null",
  source_reference: "string | null",
  status: "string",
  trade_or_domain: "string",
  unit: "string",
  updated_at: "string",
  vat_basis: "string",
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
      `${label}: ${prefix} keys mismatch\n  expected: ${expectedKeys.join(", ")}\n  actual: ${actualKeys.join(", ")}`,
    );
  }
  for (const key of expectedKeys) {
    if (actual[key] !== expected[key]) {
      throw new Error(`${label}: ${prefix}.${key} expected ${expected[key]}, got ${actual[key]}`);
    }
  }
}

/**
 * @param {string} label
 * @param {string} source
 */
function extractSurface(label, source) {
  const items = extractTableRow(source, "estimate_items");
  const revisions = extractTableRow(source, "measured_boq_catalog_revisions");
  const entries = extractTableRow(source, "measured_boq_catalog_entries");
  if (!items) throw new Error(`${label}: estimate_items not found`);
  if (!revisions) throw new Error(`${label}: measured_boq_catalog_revisions not found`);
  if (!entries) throw new Error(`${label}: measured_boq_catalog_entries not found`);

  /** @type {Record<string, string>} */
  const provenance = {};
  for (const key of Object.keys(EXPECTED_ITEM_PROVENANCE)) {
    if (!(key in items)) throw new Error(`${label}: estimate_items.${key} missing`);
    provenance[key] = items[key];
  }

  if (!source.includes("estimate_items_catalog_entry_fkey")) {
    throw new Error(`${label}: estimate_items_catalog_entry_fkey relationship missing`);
  }
  if (!source.includes('referencedRelation: "measured_boq_catalog_entries"')) {
    throw new Error(`${label}: measured_boq_catalog_entries relationship missing`);
  }

  return { provenance, revisions, entries };
}

/**
 * @param {string} label
 * @param {string} source
 */
function verifySurface(label, source) {
  const surface = extractSurface(label, source);
  assertExactMap(label, surface.provenance, EXPECTED_ITEM_PROVENANCE, "estimate_items provenance");
  assertExactMap(label, surface.revisions, EXPECTED_REVISION_ROW, "measured_boq_catalog_revisions");
  assertExactMap(label, surface.entries, EXPECTED_ENTRY_ROW, "measured_boq_catalog_entries");
  return surface;
}

function cleanupGenerated() {
  try {
    if (existsSync(GENERATED)) {
      rmSync(GENERATED, { force: true });
    }
  } catch {
    // Best-effort only: never block the verifier on cleanup.
  }
}

function tryGenerate() {
  mkdirSync(TMP_DIR, { recursive: true });
  try {
    // Prefer repository CLI; force local DB password so a remote SUPABASE_DB_PASSWORD
    // from developer .env does not break `gen types --local` (CLI 2.111.0+).
    // Child env only — do not mutate process.env for the verifier process.
    const out = execFileSync(
      "pnpm",
      ["exec", "supabase", "gen", "types", "typescript", "--local", "--schema", "public"],
      {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
        env: { ...process.env, SUPABASE_DB_PASSWORD: "postgres" },
      },
    );
    writeFileSync(GENERATED, out);
    return true;
  } catch (err) {
    if (requireGenerate) throw err;
    return false;
  }
}

try {
  const committed = readFileSync(COMMITTED, "utf8");
  const committedSurface = verifySurface("committed", committed);
  console.log("verify-4c2c: committed surface OK");

  if (!committedOnly) {
    const generatedOk = tryGenerate();
    if (generatedOk && existsSync(GENERATED)) {
      const generated = readFileSync(GENERATED, "utf8");
      const genSurface = verifySurface("generated", generated);
      if (JSON.stringify(committedSurface) !== JSON.stringify(genSurface)) {
        throw new Error("verify-4c2c: committed vs generated surface mismatch");
      }
      console.log("verify-4c2c: generated surface matches committed");
    } else if (requireGenerate) {
      throw new Error("verify-4c2c: generation required but failed");
    } else {
      console.log("verify-4c2c: local generation skipped (Supabase unavailable)");
    }
  }

  console.log("verify-4c2c: PASS");
} finally {
  cleanupGenerated();
}
