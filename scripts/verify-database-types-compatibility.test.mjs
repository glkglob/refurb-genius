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

/**
 * Shared post-condition for successful generation+typecheck outcomes
 * (COMPATIBLE or INCOMPATIBLE). HARNESS_ERROR paths restore separately.
 */
function assertSuccessfulRunCleanup(out, hashBefore, statusBefore) {
  assert.match(
    out,
    /GeneratedFormattedChecksum: 84c292ccbbfb9236282326c165bf29a27ae720a4eb063b492b7a30fb0a8611a8/,
  );
  assert.match(out, /TrackedChecksumRestored: true/);
  assert.match(out, /WorkingTreeRestored: true/);
  assert.match(out, /TemporaryResourcesCleaned: true/);
  assert.equal(sha256File(TRACKED), hashBefore);
  assert.equal(gitStatus(), statusBefore);
}

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
  // Expected tracked checksum after P1B6 canonical full-file adoption.
  // Complete generate --local --schema public, then prettier with project
  // .prettierrc (printWidth 100). Differs from bare-default prettier output.
  assert.equal(
    hashBefore,
    "f7eca55bb06144ed7bfcc7f5dd27af1ad7d9f2a24d4191134566f5e092adebf8",
    "tracked types checksum drifted from canonical baseline",
  );

  // Sequential P1B* slices reduce diagnostics from the original 84 baseline.
  // Terminal COMPATIBLE (exit 0, 0/0 + cleanup) is valid after application
  // compatibility. Progressive INCOMPATIBLE remains valid mid-sequence.
  // HARNESS_ERROR (exit 1) is never a valid full-run success path.
  const res = runHarness({});
  const out = `${res.stdout}${res.stderr}`;
  const diagMatch = out.match(/DiagnosticCount: (\d+)/);
  const fileMatch = out.match(/AffectedFileCount: (\d+)/);
  const tcMatch = out.match(/TypecheckExitCode: (-?\d+)/);
  assert.ok(diagMatch, "DiagnosticCount missing from harness output");
  assert.ok(fileMatch, "AffectedFileCount missing from harness output");
  assert.ok(tcMatch, "TypecheckExitCode missing from harness output");
  const diagCount = Number(diagMatch[1]);
  const fileCount = Number(fileMatch[1]);
  const typecheckExit = Number(tcMatch[1]);

  // Reject infrastructure failure as if it were a compatibility outcome.
  assert.notEqual(
    res.status,
    1,
    `full harness must not report HARNESS_ERROR on a successful generation path\n${out}`,
  );
  assert.ok(
    !/Status: HARNESS_ERROR/.test(out),
    `full harness must not summarise HARNESS_ERROR when generation succeeded\n${out}`,
  );

  if (res.status === 0) {
    // State A — COMPATIBLE
    assert.match(out, /Status: COMPATIBLE/);
    assert.doesNotMatch(out, /Status: INCOMPATIBLE/);
    assert.equal(diagCount, 0, `COMPATIBLE requires DiagnosticCount 0, got ${diagCount}`);
    assert.equal(fileCount, 0, `COMPATIBLE requires AffectedFileCount 0, got ${fileCount}`);
    assert.equal(typecheckExit, 0, `COMPATIBLE requires TypecheckExitCode 0, got ${typecheckExit}`);
  } else {
    // State B — INCOMPATIBLE (never convert historical error ranges into exit 0)
    assert.equal(res.status, 2, `expected INCOMPATIBLE exit 2 or COMPATIBLE exit 0\n${out}`);
    assert.match(out, /Status: INCOMPATIBLE/);
    assert.doesNotMatch(out, /Status: COMPATIBLE/);
    assert.ok(
      diagCount > 0 && diagCount <= 84,
      `diagnostic count ${diagCount} outside progressive baseline (1..84)`,
    );
    assert.ok(
      fileCount > 0 && fileCount <= 22,
      `affected file count ${fileCount} outside progressive baseline (1..22)`,
    );
    assert.notEqual(
      typecheckExit,
      0,
      `INCOMPATIBLE requires non-zero TypecheckExitCode, got ${typecheckExit}`,
    );
  }

  assertSuccessfulRunCleanup(out, hashBefore, statusBefore);
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
  assert.match(out, /Status: COMPATIBLE/);
  assert.doesNotMatch(out, /Status: INCOMPATIBLE/);
  assert.doesNotMatch(out, /Status: HARNESS_ERROR/);
  const diagMatch = out.match(/DiagnosticCount: (\d+)/);
  const fileMatch = out.match(/AffectedFileCount: (\d+)/);
  assert.ok(diagMatch && fileMatch, "COMPATIBLE inject missing diagnostic summary");
  assert.equal(Number(diagMatch[1]), 0);
  assert.equal(Number(fileMatch[1]), 0);
  assertSuccessfulRunCleanup(out, hashBefore, statusBefore);
});

test("injected typecheck fail path yields INCOMPATIBLE with non-zero diagnostics", () => {
  const statusProbe = spawnSync("pnpm", ["exec", "supabase", "status"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (statusProbe.status !== 0) {
    console.log("skip INCOMPATIBLE inject: local Supabase unavailable");
    return;
  }

  const statusBefore = gitStatus();
  const hashBefore = sha256File(TRACKED);

  const res = runHarness({
    VERIFY_DB_TYPES_COMPAT_INJECT_TYPECHECK: "fail",
  });
  const out = `${res.stdout}${res.stderr}`;
  assert.equal(res.status, 2, `expected INCOMPATIBLE exit 2\n${out}`);
  assert.match(out, /Status: INCOMPATIBLE/);
  assert.doesNotMatch(out, /Status: COMPATIBLE/);
  assert.doesNotMatch(out, /Status: HARNESS_ERROR/);
  const diagMatch = out.match(/DiagnosticCount: (\d+)/);
  const fileMatch = out.match(/AffectedFileCount: (\d+)/);
  assert.ok(diagMatch && fileMatch, "INCOMPATIBLE inject missing diagnostic summary");
  assert.ok(Number(diagMatch[1]) > 0, "INCOMPATIBLE requires diagnostics > 0");
  assert.ok(Number(fileMatch[1]) > 0, "INCOMPATIBLE requires affected files > 0");
  // Historical error counts must never become exit 0
  assert.notEqual(res.status, 0);
  assertSuccessfulRunCleanup(out, hashBefore, statusBefore);
});
