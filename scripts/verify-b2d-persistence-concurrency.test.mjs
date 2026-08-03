/**
 * Focused harness for the B2D1/B2D2R multi-session concurrency verifier.
 * Skips when local Supabase is unavailable.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERIFIER = join(ROOT, "scripts/verify-b2d-persistence-concurrency.mjs");
const DEFAULT_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function localDbUp() {
  const res = spawnSync("psql", [DEFAULT_URL, "-Atc", "SELECT 1"], {
    encoding: "utf8",
    timeout: 5_000,
  });
  return res.status === 0 && (res.stdout || "").trim() === "1";
}

test("concurrency verifier script exists and refuses remote hosts", () => {
  assert.equal(existsSync(VERIFIER), true);
  const src = readFileSync(VERIFIER, "utf8");
  assert.match(src, /pg_advisory_lock/);
  assert.match(src, /persist_measured_boq_catalog_draft/);
  assert.match(src, /backend_pid|backendPid|BACKEND_PID/);
  assert.match(src, /pg_stat_activity/);
  assert.match(src, /pg_locks/);
  assert.match(src, /Refusing non-local|assertLocalUrl/);
  assert.match(src, /measured-boq-persist-request:/);
  assert.match(src, /cross_package_request_conflict/);
  assert.match(src, /hashtextextended/);
  assert.match(src, /barrierMode/);
  assert.doesNotMatch(src, /service_role.*eyJ|SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/);
});

test("cross_package_request_conflict scenario is fully specified", () => {
  const src = readFileSync(VERIFIER, "utf8");
  assert.match(src, /name:\s*["']cross_package_request_conflict["']/);
  assert.match(src, /holdRequestId/);
  assert.match(src, /barrierMode:\s*["']request["']/);
  // Must require distinct input checksums and reject database_failure.
  assert.match(src, /cross_package_request_conflict fixtures must differ in input checksum/);
  assert.match(src, /cross_package_request_conflict produced database_failure/);
  assert.match(src, /created \+ request_conflict/);
  // Prior scenarios remain.
  for (const name of [
    "exact_request_replay",
    "package_replay",
    "request_conflict",
    "revision_conflict",
    "independent_packages",
  ]) {
    assert.match(src, new RegExp(name));
  }
});

test("multi-session concurrency verifier PASS on local database", { timeout: 180_000 }, () => {
  if (!localDbUp()) {
    console.log("skip B2D2R concurrency verifier: local Postgres unavailable");
    return;
  }
  const res = spawnSync(process.execPath, [VERIFIER], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      B2D_CONCURRENCY_DATABASE_URL: DEFAULT_URL,
    },
    timeout: 150_000,
  });
  const out = `${res.stdout || ""}${res.stderr || ""}`;
  assert.equal(res.status, 0, out.slice(-3000));
  assert.match(out, /"Status": "PASS"/);
  assert.match(out, /exact_request_replay/);
  assert.match(out, /package_replay/);
  assert.match(out, /request_conflict/);
  assert.match(out, /revision_conflict/);
  assert.match(out, /independent_packages/);
  assert.match(out, /cross_package_request_conflict/);
  assert.match(out, /"pidsDistinct": true/);
  assert.doesNotMatch(out, /"database_failure"/);
});
