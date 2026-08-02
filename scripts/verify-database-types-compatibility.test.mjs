/**
 * Focused tests for 4C2E-B2C1T-P1B0 compatibility harness.
 *
 * Run: node --test scripts/verify-database-types-compatibility.test.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";
import test from "node:test";
import { parseTypecheckDiagnostics, sha256File } from "./verify-database-types-compatibility.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/verify-database-types-compatibility.mjs");
const TRACKED = join(ROOT, "packages/supabase/src/database.types.ts");
const TRACKED_REL = "packages/supabase/src/database.types.ts";

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function gitStatus() {
  return execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

function runHarness(env = {}, args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, ...env },
    maxBuffer: 20 * 1024 * 1024,
  });
}

test("parseTypecheckDiagnostics counts TS diagnostics and unique files", () => {
  const sample = `
src/a.ts(1,2): error TS2339: Property 'x' does not exist on type 'Y'.
src/a.ts(3,4): error TS2339: Property 'z' does not exist on type 'Y'.
src/b.ts(1,1): error TS2353: Object literal may only specify known properties.
Some other line
error not a diagnostic
`;
  const parsed = parseTypecheckDiagnostics(sample);
  assert.equal(parsed.diagnosticCount, 3);
  assert.equal(parsed.files.length, 2);
  assert.equal(parsed.codes.TS2339, 2);
  assert.equal(parsed.codes.TS2353, 1);
});

test("sha256File is stable for tracked types", () => {
  assert.ok(existsSync(TRACKED));
  const a = sha256File(TRACKED);
  const b = sha256File(TRACKED);
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("dirty tracked type file is refused (HARNESS_ERROR)", () => {
  const statusBefore = gitStatus();
  // Must not already have dirty tracked types
  assert.ok(!statusBefore.includes(TRACKED_REL), "tracked types already dirty");

  const original = readFileSync(TRACKED);
  const originalHash = sha256(original);
  try {
    writeFileSync(TRACKED, `${original.toString("utf8")}\n// dirty-probe\n`);
    const res = runHarness({
      VERIFY_DB_TYPES_COMPAT_INJECT_GEN: "fail",
    });
    assert.equal(
      res.status,
      1,
      `expected HARNESS_ERROR exit 1, got ${res.status}\n${res.stdout}\n${res.stderr}`,
    );
    assert.match(`${res.stdout}${res.stderr}`, /already modified|HARNESS_ERROR|Refuse/i);
  } finally {
    writeFileSync(TRACKED, original);
  }
  assert.equal(sha256File(TRACKED), originalHash);
  assert.equal(gitStatus(), statusBefore);
});

test("injected generation failure does not alter tracked file", () => {
  const statusBefore = gitStatus();
  const hashBefore = sha256File(TRACKED);

  const res = runHarness({
    VERIFY_DB_TYPES_COMPAT_INJECT_GEN: "fail",
  });
  assert.equal(res.status, 1);
  assert.match(`${res.stdout}${res.stderr}`, /HARNESS_ERROR|injected generation/i);
  assert.equal(sha256File(TRACKED), hashBefore);
  assert.equal(gitStatus(), statusBefore);
});

test("injected empty generation is HARNESS_ERROR and restores tree", () => {
  const statusBefore = gitStatus();
  const hashBefore = sha256File(TRACKED);

  const res = runHarness({
    VERIFY_DB_TYPES_COMPAT_INJECT_GEN: "empty",
  });
  assert.equal(res.status, 1);
  assert.equal(sha256File(TRACKED), hashBefore);
  assert.equal(gitStatus(), statusBefore);
});

test("injected formatter failure restores tracked file", () => {
  // Needs real generation (local Supabase). Skip if unavailable.
  const statusProbe = spawnSync("pnpm", ["exec", "supabase", "status"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (statusProbe.status !== 0) {
    return;
  }

  const statusBefore = gitStatus();
  const hashBefore = sha256File(TRACKED);

  const res = runHarness({
    VERIFY_DB_TYPES_COMPAT_INJECT_FORMAT: "fail",
  });
  assert.equal(res.status, 1, `${res.stdout}\n${res.stderr}`);
  assert.equal(sha256File(TRACKED), hashBefore);
  assert.equal(gitStatus(), statusBefore);
});

test("full harness: progressive INCOMPATIBLE or terminal COMPATIBLE, restore when Supabase up", () => {
  const statusProbe = spawnSync("pnpm", ["exec", "supabase", "status"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (statusProbe.status !== 0) {
    console.log("skip full baseline: local Supabase unavailable");
    return;
  }

  const statusBefore = gitStatus();
  const hashBefore = sha256File(TRACKED);
  // Expected tracked checksum at B0 authorisation (f5b5489)
  assert.equal(
    hashBefore,
    "e283eab4697c8a5e19ef98b0e3cd86362a3d5ea2c6b1bf6b6d8a67cd3a1e08b9",
    "tracked types checksum drifted from authorised baseline",
  );

  // Sequential P1B* slices reduce diagnostics from the original 84 baseline.
  // Terminal COMPATIBLE (exit 0, 0 diagnostics) is valid after P1B4 application
  // compatibility; progressive INCOMPATIBLE remains valid mid-sequence.
  const res = runHarness({});
  const out = `${res.stdout}${res.stderr}`;
  const diagMatch = out.match(/DiagnosticCount: (\d+)/);
  const fileMatch = out.match(/AffectedFileCount: (\d+)/);
  assert.ok(diagMatch, "DiagnosticCount missing from harness output");
  assert.ok(fileMatch, "AffectedFileCount missing from harness output");
  const diagCount = Number(diagMatch[1]);
  const fileCount = Number(fileMatch[1]);

  if (res.status === 0) {
    assert.match(out, /Status: COMPATIBLE/);
    assert.equal(diagCount, 0, `COMPATIBLE requires DiagnosticCount 0, got ${diagCount}`);
    assert.equal(fileCount, 0, `COMPATIBLE requires AffectedFileCount 0, got ${fileCount}`);
  } else {
    assert.equal(res.status, 2, `expected INCOMPATIBLE exit 2 or COMPATIBLE exit 0\n${out}`);
    assert.match(out, /Status: INCOMPATIBLE/);
    assert.ok(
      diagCount > 0 && diagCount <= 84,
      `diagnostic count ${diagCount} outside progressive baseline (1..84)`,
    );
    assert.ok(
      fileCount > 0 && fileCount <= 22,
      `affected file count ${fileCount} outside progressive baseline (1..22)`,
    );
  }
  assert.match(
    out,
    /GeneratedFormattedChecksum: 84c292ccbbfb9236282326c165bf29a27ae720a4eb063b492b7a30fb0a8611a8/,
  );
  assert.match(out, /TrackedChecksumRestored: true/);
  assert.match(out, /WorkingTreeRestored: true/);

  assert.equal(sha256File(TRACKED), hashBefore);
  assert.equal(gitStatus(), statusBefore);
});

test("injected typecheck ok path yields COMPATIBLE without leaving dirt", () => {
  const statusProbe = spawnSync("pnpm", ["exec", "supabase", "status"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (statusProbe.status !== 0) {
    console.log("skip COMPATIBLE inject: local Supabase unavailable");
    return;
  }

  const statusBefore = gitStatus();
  const hashBefore = sha256File(TRACKED);

  const res = runHarness({
    VERIFY_DB_TYPES_COMPAT_INJECT_TYPECHECK: "ok",
  });
  const out = `${res.stdout}${res.stderr}`;
  assert.equal(res.status, 0, out);
  assert.match(out, /Status: COMPATIBLE|COMPATIBLE/);
  assert.equal(sha256File(TRACKED), hashBefore);
  assert.equal(gitStatus(), statusBefore);
});
