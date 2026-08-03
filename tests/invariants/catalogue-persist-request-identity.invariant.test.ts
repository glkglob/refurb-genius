/**
 * 4C2E-B2D2R — draft persistence request-identity lock architecture seals.
 *
 * Proves the additive repair migration serializes by request identity before
 * package identity, without reopening table DML or changing the public RPC
 * signature surface.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function exists(rel: string): boolean {
  return existsSync(join(ROOT, rel));
}

const REPAIR_MIGRATION =
  "supabase/migrations/20260803140000_persist_measured_boq_catalogue_request_identity_repair.sql";
const ORIGINAL_PERSIST =
  "supabase/migrations/20260802233000_persist_measured_boq_catalog_draft.sql";
const REPO =
  "src/features/estimate/infrastructure/catalogue/measuredBoqCataloguePersistence.repository.server.ts";

describe("catalogue persist request-identity repair (4C2E-B2D2R)", () => {
  it("additive repair migration exists and is the latest B2D persist repair", () => {
    assert.equal(exists(REPAIR_MIGRATION), true);
    assert.equal(exists(ORIGINAL_PERSIST), true);
    const names = readdirSync(join(ROOT, "supabase/migrations")).filter((n) => n.endsWith(".sql"));
    assert.ok(
      names.includes("20260803140000_persist_measured_boq_catalogue_request_identity_repair.sql"),
    );
    // Original B2D migration must remain unedited (still package-lock-first).
    const original = read(ORIGINAL_PERSIST);
    assert.match(original, /pg_advisory_xact_lock\(v_lock_k1, v_lock_k2\)/);
    assert.doesNotMatch(original, /measured-boq-persist-request:/);
  });

  it("repair adds request lock namespace with command scope and request UUID", () => {
    const src = read(REPAIR_MIGRATION);
    assert.match(src, /measured-boq-persist-request:/);
    assert.match(src, /persist_draft/);
    assert.match(src, /p_request_id::text/);
    assert.match(src, /hashtextextended/);
    assert.match(src, /pg_advisory_xact_lock/);
    assert.doesNotMatch(src, /pg_advisory_lock\s*\(/); // no session-level lock in RPC
  });

  it("request lock precedes package lock and event lookup", () => {
    const src = read(REPAIR_MIGRATION);
    const requestPos = src.indexOf("measured-boq-persist-request:");
    const packagePos = src.indexOf("pg_advisory_xact_lock(v_lock_k1, v_lock_k2)");
    const eventLookupPos = src.indexOf("command_scope = v_cmd_scope");
    assert.ok(requestPos > 0, "request lock namespace present");
    assert.ok(packagePos > 0, "package lock present");
    assert.ok(eventLookupPos > 0, "event lookup present");
    assert.ok(requestPos < packagePos, "request lock before package lock");
    assert.ok(packagePos < eventLookupPos, "package lock before event lookup");
  });

  it("unique_violation reclassifies via durable event re-read", () => {
    const src = read(REPAIR_MIGRATION);
    assert.match(src, /WHEN unique_violation THEN/);
    assert.match(src, /idempotent_replay/);
    assert.match(src, /request_conflict/);
    // Must not blindly return database_failure as the only unique_violation path.
    const uvBlock = src.slice(src.indexOf("WHEN unique_violation THEN"));
    assert.match(uvBlock, /SELECT \*\s+INTO v_existing_event/s);
    assert.match(uvBlock, /request_conflict/);
  });

  it("public signature and security posture are preserved", () => {
    const src = read(REPAIR_MIGRATION);
    assert.match(
      src,
      /CREATE OR REPLACE FUNCTION public\.persist_measured_boq_catalog_draft\(\s*p_manifest_text text,/s,
    );
    assert.match(src, /SECURITY DEFINER/);
    assert.match(src, /SET search_path = ''/);
    assert.match(src, /OWNER TO postgres/);
    assert.match(src, /GRANT EXECUTE[\s\S]*TO service_role/);
    assert.match(src, /REVOKE ALL[\s\S]*FROM anon/);
    assert.match(src, /REVOKE ALL[\s\S]*FROM authenticated/);
    assert.match(src, /REVOKE ALL[\s\S]*FROM PUBLIC/);
  });

  it("repository remains single RPC write path with no direct catalogue DML", () => {
    const src = read(REPO);
    assert.equal((src.match(/\.rpc\s*\(/g) ?? []).length, 1);
    assert.doesNotMatch(src, /\.from\s*\(\s*["']measured_boq_catalog_/);
  });

  it("no active pointer or lifecycle CLI introduced by the repair surface", () => {
    const src = read(REPAIR_MIGRATION);
    assert.doesNotMatch(src, /active_revision|set_active|republish/i);
    assert.doesNotMatch(src, /CREATE TABLE/);
    assert.doesNotMatch(src, /ALTER TABLE/);
    const pkg = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
    const keys = Object.keys(pkg.scripts ?? {})
      .filter((k) => /catalogue|catalog/i.test(k))
      .sort();
    assert.deepEqual(keys, ["catalogue:dry-run", "catalogue:persist"]);
  });
});
