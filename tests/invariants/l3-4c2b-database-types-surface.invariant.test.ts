/**
 * Ticket 4C2B — database types surface gate (CI-safe, no local Supabase required).
 *
 * Full `database.types.ts` regeneration is pre-existing baseline debt: local
 * migrations omit remote-only tables (scope_analyses*, analysis_jobs). This
 * invariant locks the 4C2B table/column/RPC contract on the committed file and
 * runs the shared verifier in --committed-only mode.
 *
 * Full generate-and-compare:
 *   node scripts/verify-4c2b-database-types.mjs --require-generate
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const TYPES = "packages/supabase/src/database.types.ts";
const VERIFIER = "scripts/verify-4c2b-database-types.mjs";

test("4C2B types verifier script is tracked", () => {
  assert.ok(existsSync(join(ROOT, VERIFIER)), "verify-4c2b-database-types.mjs must exist");
  assert.ok(existsSync(join(ROOT, TYPES)), "database.types.ts must exist");
});

test("committed database.types.ts declares 4C2B estimates markers", () => {
  const text = readFileSync(join(ROOT, TYPES), "utf8");
  assert.match(text, /pricing_authority:\s*string/);
  assert.match(text, /pricing_policy_version:\s*string \| null/);
  assert.match(text, /catalog_revision:\s*string \| null/);
});

test("committed database.types.ts declares estimate_authority_idempotency", () => {
  const text = readFileSync(join(ROOT, TYPES), "utf8");
  assert.match(text, /estimate_authority_idempotency:\s*\{/);
  assert.match(text, /idempotency_key:\s*string/);
  assert.match(text, /payload_hash:\s*string/);
  assert.match(text, /operation_status:\s*string/);
  assert.match(text, /resulting_estimate_id:\s*string \| null/);
});

test("committed database.types.ts declares persist_category_engine_estimate RPC", () => {
  const text = readFileSync(join(ROOT, TYPES), "utf8");
  assert.match(text, /persist_category_engine_estimate:\s*\{/);
  assert.match(text, /p_expected_owner_id:\s*string/);
  assert.match(text, /p_payload_hash:\s*string/);
  assert.match(text, /p_pricing_policy_version:\s*string/);
  assert.match(text, /p_items:\s*Json/);
  assert.match(text, /Returns:\s*Json/);
});

test("4C2B types verifier passes in committed-only mode", () => {
  const out = execFileSync(process.execPath, [join(ROOT, VERIFIER), "--committed-only"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.match(out, /PASS|committed 4C2B surface matches contract/);
});
