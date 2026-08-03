/**
 * Focused tests for 4C2E-B2C1T-P1B6 complete-file canonical verifier.
 *
 * Run: node --test scripts/verify-database-types-canonical.test.mjs
 *   or: pnpm verify:database-types:canonical:test
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";
import test from "node:test";
import { CanonicalVerifyError, sha256File } from "./verify-database-types-canonical.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/verify-database-types-canonical.mjs");
const TRACKED = join(ROOT, "packages/supabase/src/database.types.ts");
const TRACKED_REL = "packages/supabase/src/database.types.ts";

test("CanonicalVerifyError preserves message, name, code, and stack without suppression", () => {
  const err = new CanonicalVerifyError("typed probe");
  assert.equal(err.message, "typed probe");
  assert.equal(err.name, "CanonicalVerifyError");
  assert.equal(err.canonicalCode, "CANONICAL_VERIFY_ERROR");
  assert.ok(err.stack && err.stack.includes("CanonicalVerifyError"));
  assert.ok(err instanceof Error);
  assert.ok(err instanceof CanonicalVerifyError);
});

test("production canonical verifier source has no TypeScript suppressions", () => {
  const src = readFileSync(SCRIPT, "utf8");
  assert.doesNotMatch(src, /@ts-expect-error|@ts-ignore|ts-nocheck|eslint-disable/);
  assert.doesNotMatch(src, /\bas any\b|as unknown as|unknown as/);
});

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function gitStatus() {
  return execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

/**
 * @param {Record<string, string | undefined>} env
 */
function runVerifier(env = {}) {
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, ...env },
    maxBuffer: 20 * 1024 * 1024,
  });
}

test("sha256File is stable for tracked types", () => {
  assert.ok(existsSync(TRACKED));
  const a = sha256File(TRACKED);
  const b = sha256File(TRACKED);
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("exact canonical tracked file passes complete-file verification", () => {
  const statusBefore = gitStatus();
  const original = readFileSync(TRACKED);
  const originalHash = sha256(original);

  const res = runVerifier();
  assert.equal(
    res.status,
    0,
    `expected PASS exit 0, got ${res.status}\n${res.stdout}\n${res.stderr}`,
  );
  assert.match(res.stdout, /ByteEquality: true/);
  assert.match(res.stdout, /Status: PASS/);
  assert.match(res.stdout, /\[verify-database-types-canonical\] PASS/);

  const after = readFileSync(TRACKED);
  assert.equal(sha256(after), originalHash, "tracked file must not be rewritten");
  assert.equal(gitStatus(), statusBefore, "working-tree status must be preserved");
});

test("one-byte tracked-file drift fails complete-file verification", () => {
  const statusBefore = gitStatus();
  const original = readFileSync(TRACKED);
  const originalHash = sha256(original);

  try {
    // Harmless one-byte-class drift at end of file
    writeFileSync(TRACKED, Buffer.concat([original, Buffer.from("\n")]));
    assert.notEqual(sha256File(TRACKED), originalHash);

    const res = runVerifier();
    assert.notEqual(res.status, 0, "drift must fail");
    const combined = `${res.stdout}${res.stderr}`;
    assert.match(combined, /DRIFT|ByteEquality: false|!= generated/i);
  } finally {
    writeFileSync(TRACKED, original);
  }

  assert.equal(sha256File(TRACKED), originalHash, "tracked file restored after drift probe");
  // Status may still show M from other P1B6 work; ensure tracked bytes match original
  const after = readFileSync(TRACKED);
  assert.ok(original.equals(after));
  // Porcelain for TRACKED should match pre-probe (both clean or both same)
  const statusAfter = gitStatus();
  const trackedDirtyBefore = statusBefore.includes(TRACKED_REL);
  const trackedDirtyAfter = statusAfter.includes(TRACKED_REL);
  assert.equal(trackedDirtyAfter, trackedDirtyBefore);
});

test("empty generation fails", () => {
  const original = readFileSync(TRACKED);
  const originalHash = sha256(original);
  const statusBefore = gitStatus();

  const res = runVerifier({ VERIFY_DB_TYPES_CANONICAL_INJECT_GEN: "empty" });
  assert.equal(res.status, 1, `expected exit 1, got ${res.status}\n${res.stdout}\n${res.stderr}`);
  assert.match(`${res.stdout}${res.stderr}`, /empty|ERROR/i);

  assert.equal(sha256(readFileSync(TRACKED)), originalHash);
  assert.equal(gitStatus(), statusBefore);
});

test("generation command failure fails", () => {
  const original = readFileSync(TRACKED);
  const originalHash = sha256(original);
  const statusBefore = gitStatus();

  const res = runVerifier({ VERIFY_DB_TYPES_CANONICAL_INJECT_GEN: "fail" });
  assert.equal(res.status, 1);
  assert.match(`${res.stdout}${res.stderr}`, /injected generation failure|ERROR/i);

  assert.equal(sha256(readFileSync(TRACKED)), originalHash);
  assert.equal(gitStatus(), statusBefore);
});

test("formatter failure fails", () => {
  const original = readFileSync(TRACKED);
  const originalHash = sha256(original);
  const statusBefore = gitStatus();

  const res = runVerifier({ VERIFY_DB_TYPES_CANONICAL_INJECT_FORMAT: "fail" });
  assert.equal(res.status, 1);
  assert.match(`${res.stdout}${res.stderr}`, /formatter failure|ERROR/i);

  assert.equal(sha256(readFileSync(TRACKED)), originalHash);
  assert.equal(gitStatus(), statusBefore);
});

test("cleanup failure fails where testable", () => {
  const original = readFileSync(TRACKED);
  const originalHash = sha256(original);
  const statusBefore = gitStatus();

  const res = runVerifier({ VERIFY_DB_TYPES_CANONICAL_INJECT_CLEANUP: "fail" });
  assert.equal(res.status, 1);
  assert.match(`${res.stdout}${res.stderr}`, /cleanup failure|ERROR/i);

  assert.equal(sha256(readFileSync(TRACKED)), originalHash);
  assert.equal(gitStatus(), statusBefore);
});

test("partial or catalogue-only generated surface fails complete-file verification", () => {
  const original = readFileSync(TRACKED);
  const originalHash = sha256(original);
  const statusBefore = gitStatus();

  const res = runVerifier({ VERIFY_DB_TYPES_CANONICAL_INJECT_GEN: "partial" });
  assert.notEqual(res.status, 0, "partial generation must not pass complete-file gate");
  const combined = `${res.stdout}${res.stderr}`;
  assert.match(combined, /DRIFT|ByteEquality: false|!= generated/i);

  assert.equal(sha256(readFileSync(TRACKED)), originalHash);
  assert.equal(gitStatus(), statusBefore);
});

test("bare (non-authoritative) formatter drift fails against project-formatted tracked file", () => {
  const statusProbe = spawnSync("pnpm", ["exec", "supabase", "status"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (statusProbe.status !== 0) {
    console.log("skip bare-formatter drift: local Supabase unavailable");
    return;
  }

  const original = readFileSync(TRACKED);
  const originalHash = sha256(original);
  const statusBefore = gitStatus();

  // Option A: tracked file uses project config; bare inject yields different bytes.
  const res = runVerifier({ VERIFY_DB_TYPES_CANONICAL_INJECT_FORMAT: "bare" });
  assert.notEqual(res.status, 0, "bare formatter must not pass complete-file gate");
  const combined = `${res.stdout}${res.stderr}`;
  assert.match(combined, /DRIFT|ByteEquality: false|!= generated/i);
  assert.match(combined, /FormatterCommand:.*--config/);

  assert.equal(sha256(readFileSync(TRACKED)), originalHash);
  assert.equal(gitStatus(), statusBefore);
});

test("tracked file restored after mutation probes and working-tree preserved", () => {
  const statusBefore = gitStatus();
  const original = readFileSync(TRACKED);
  const originalHash = sha256(original);

  try {
    writeFileSync(TRACKED, `${original.toString("utf8").slice(0, -1)}X`);
    const res = runVerifier();
    assert.notEqual(res.status, 0);
  } finally {
    writeFileSync(TRACKED, original);
  }

  assert.equal(sha256(readFileSync(TRACKED)), originalHash);
  const statusAfter = gitStatus();
  const trackedDirtyBefore = statusBefore.includes(TRACKED_REL);
  const trackedDirtyAfter = statusAfter.includes(TRACKED_REL);
  assert.equal(trackedDirtyAfter, trackedDirtyBefore);
});
