#!/usr/bin/env node
/**
 * 4C2E-B2C1T-P1B0 — Canonical database-types compatibility harness.
 *
 * Validates the application against complete, unfiltered local Supabase
 * generated types (public schema) without permanently changing tracked files.
 *
 * Isolation strategy: temporary substitution of the tracked type file with
 * guaranteed restoration (checksum + git status integrity).
 *
 * Exit codes:
 *   0 — COMPATIBLE   (typecheck clean against canonical types; tree restored)
 *   2 — INCOMPATIBLE (typecheck failed; generation ok; tree restored)
 *   1 — HARNESS_ERROR (infra/generation/format/restore/cleanup failure)
 *
 * Usage:
 *   node scripts/verify-database-types-compatibility.mjs
 *   node scripts/verify-database-types-compatibility.mjs --expect-errors 84
 *   pnpm verify:database-types:compatibility
 *
 * Optional env (tests / controlled probes only):
 *   VERIFY_DB_TYPES_COMPAT_INJECT_GEN=fail|empty
 *   VERIFY_DB_TYPES_COMPAT_INJECT_FORMAT=fail|bare
 *   VERIFY_DB_TYPES_COMPAT_INJECT_TYPECHECK=fail|ok
 *   VERIFY_DB_TYPES_COMPAT_ALLOW_DIRTY=1  (allow unrelated dirty files; tracked types must still be clean)
 */

import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TRACKED = join(ROOT, "packages/supabase/src/database.types.ts");
const TRACKED_REL = "packages/supabase/src/database.types.ts";

const EXIT = {
  COMPATIBLE: 0,
  HARNESS_ERROR: 1,
  INCOMPATIBLE: 2,
};

/** Same generation + formatter contract as the full-file canonical verifier. */
const CANONICAL_COMMAND =
  "SUPABASE_DB_PASSWORD=postgres pnpm exec supabase gen types typescript --local --schema public";
// Always pass project .prettierrc — formatting temp paths outside the repo
// otherwise falls back to Prettier defaults (printWidth 80) and drifts from
// in-repo / eslint-plugin-prettier output (printWidth 100).
const PRETTIER_CONFIG = join(ROOT, ".prettierrc");
const FORMATTER_COMMAND = "pnpm exec prettier --write --config <repo>/.prettierrc <generated-file>";

const CANONICAL_GEN_ARGS = [
  "exec",
  "supabase",
  "gen",
  "types",
  "typescript",
  "--local",
  "--schema",
  "public",
];

/**
 * @param {string} filePath
 */
export function sha256File(filePath) {
  const buf = readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * @param {string} text
 * @returns {{ codes: Record<string, number>, files: string[], diagnosticCount: number }}
 */
export function parseTypecheckDiagnostics(text) {
  // Match TypeScript compiler diagnostic lines, e.g.:
  //   src/foo.ts(1,2): error TS2339: ...
  const re = /^(.+?)\((\d+),(\d+)\): error (TS\d+):/gm;
  /** @type {Record<string, number>} */
  const codes = {};
  const fileSet = new Set();
  let diagnosticCount = 0;
  for (const m of text.matchAll(re)) {
    diagnosticCount += 1;
    const file = m[1].replace(/\\/g, "/");
    const code = m[4];
    fileSet.add(file);
    codes[code] = (codes[code] ?? 0) + 1;
  }
  return {
    codes,
    files: [...fileSet].sort(),
    diagnosticCount,
  };
}

/**
 * @returns {string}
 */
function gitStatusPorcelain() {
  return execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

/**
 * @returns {string}
 */
function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * @param {string} status
 */
function trackedFileDirty(status) {
  for (const line of status.split("\n")) {
    if (!line) continue;
    // XY<path> or XY <path> — path starts after first 3 chars typically " M path" or "M  path"
    const path = line.slice(3).trim().replace(/^"|"$/g, "");
    // rename: "R  old -> new"
    if (
      path === TRACKED_REL ||
      path.endsWith(`/${TRACKED_REL}`) ||
      path.includes(` ${TRACKED_REL}`)
    ) {
      return true;
    }
    if (path.split(" -> ").some((p) => p.trim() === TRACKED_REL)) {
      return true;
    }
  }
  return false;
}

/**
 * Explicit typed failure for the compatibility harness.
 * Avoids mutating plain Error with ad-hoc properties under suppression.
 */
export class DatabaseTypesHarnessError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = "DatabaseTypesHarnessError";
    /** @type {"HARNESS_ERROR"} */
    this.harnessCode = "HARNESS_ERROR";
  }
}

/**
 * @param {string} message
 * @returns {never}
 */
function harnessError(message) {
  throw new DatabaseTypesHarnessError(message);
}

function assertTools() {
  for (const cmd of ["git", "pnpm", "node"]) {
    try {
      execFileSync(cmd === "node" ? process.execPath : cmd, ["--version"], {
        stdio: "pipe",
      });
    } catch {
      harnessError(`required command not available: ${cmd}`);
    }
  }
  if (!existsSync(TRACKED)) {
    harnessError(`tracked type file missing: ${TRACKED_REL}`);
  }
}

function assertSupabaseReachable() {
  const inject = process.env.VERIFY_DB_TYPES_COMPAT_INJECT_GEN;
  if (inject) return;
  const res = spawnSync("pnpm", ["exec", "supabase", "status"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
  });
  if (res.status !== 0) {
    harnessError(
      "local Supabase is unavailable (pnpm exec supabase status failed). " +
        "Start it with `pnpm supabase:start` and retry.",
    );
  }
}

/**
 * @param {string} outPath
 */
function generateCanonical(outPath) {
  const inject = process.env.VERIFY_DB_TYPES_COMPAT_INJECT_GEN;
  if (inject === "fail") {
    harnessError("injected generation failure");
  }
  if (inject === "empty") {
    writeFileSync(outPath, "", "utf8");
    return { raw: "", stderr: "injected empty" };
  }

  const res = spawnSync("pnpm", CANONICAL_GEN_ARGS, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, SUPABASE_DB_PASSWORD: "postgres" },
  });
  if (res.status !== 0) {
    harnessError(
      `canonical type generation failed (exit ${res.status}): ${res.stderr || res.stdout || "no output"}`,
    );
  }
  const raw = res.stdout ?? "";
  if (!raw.trim()) {
    harnessError("canonical type generation produced empty stdout");
  }
  if (!raw.includes("export type Database") && !raw.includes("export type Json")) {
    harnessError("canonical type generation output is not a plausible Database types file");
  }
  writeFileSync(outPath, raw, "utf8");
  return { raw, stderr: res.stderr ?? "" };
}

/**
 * Authoritative project-config formatter (shared contract with full-file verifier).
 * @param {string} filePath
 */
function formatGenerated(filePath) {
  const inject = process.env.VERIFY_DB_TYPES_COMPAT_INJECT_FORMAT;
  if (inject === "fail") {
    harnessError("injected formatter failure");
  }
  // Non-authoritative bare prettier (defaults only) — tests prove checksum drift.
  if (inject === "bare") {
    const bare = spawnSync("pnpm", ["exec", "prettier", "--write", filePath], {
      cwd: ROOT,
      encoding: "utf8",
      env: process.env,
    });
    if (bare.status !== 0) {
      harnessError(
        `bare prettier formatting failed (exit ${bare.status}): ${bare.stderr || bare.stdout || "no output"}`,
      );
    }
    return;
  }
  const res = spawnSync(
    "pnpm",
    ["exec", "prettier", "--write", "--config", PRETTIER_CONFIG, filePath],
    {
      cwd: ROOT,
      encoding: "utf8",
      env: process.env,
    },
  );
  if (res.status !== 0) {
    harnessError(
      `prettier formatting failed (exit ${res.status}): ${res.stderr || res.stdout || "no output"}`,
    );
  }
}

/**
 * @returns {{ exitCode: number, stdout: string, stderr: string, combined: string }}
 */
function runTypecheck() {
  const inject = process.env.VERIFY_DB_TYPES_COMPAT_INJECT_TYPECHECK;
  if (inject === "fail") {
    return {
      exitCode: 2,
      stdout: "src/injected.ts(1,1): error TS2339: Property 'x' does not exist on type '{}'.\n",
      stderr: "",
      combined: "src/injected.ts(1,1): error TS2339: Property 'x' does not exist on type '{}'.\n",
    };
  }
  if (inject === "ok") {
    return { exitCode: 0, stdout: "", stderr: "", combined: "" };
  }

  const res = spawnSync("pnpm", ["typecheck"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env: process.env,
  });
  const stdout = res.stdout ?? "";
  const stderr = res.stderr ?? "";
  return {
    exitCode: res.status ?? 1,
    stdout,
    stderr,
    combined: `${stdout}${stderr}`,
  };
}

/**
 * @param {Record<string, unknown>} summary
 */
function printSummary(summary) {
  console.log("--- database-types-compatibility ---");
  for (const [k, v] of Object.entries(summary)) {
    if (v === undefined) continue;
    if (typeof v === "object" && v !== null) {
      console.log(`${k}: ${JSON.stringify(v)}`);
    } else {
      console.log(`${k}: ${v}`);
    }
  }
  console.log("--- end ---");
}

/**
 * @param {{ expectErrors?: number | null }} opts
 */
export function runCompatibilityCheck(opts = {}) {
  assertTools();

  const statusBefore = gitStatusPorcelain();
  // Dirty-tree policy: refuse only when the tracked generated type file is
  // already modified (would risk clobbering local type edits). Unrelated dirty
  // files are allowed if and only if the porcelain status is byte-identical
  // after the run.
  if (trackedFileDirty(statusBefore)) {
    harnessError(
      `${TRACKED_REL} is already modified. Refuse to run (would risk overwriting local type edits).`,
    );
  }

  const head = gitHead();
  const trackedChecksumBefore = sha256File(TRACKED);
  const trackedBytesBefore = readFileSync(TRACKED);

  let tempDir = "";
  let substituted = false;
  /** @type {Record<string, unknown>} */
  const summary = {
    Status: "HARNESS_ERROR",
    RepositoryHEAD: head,
    CanonicalCommand: CANONICAL_COMMAND,
    FormatterCommand: FORMATTER_COMMAND,
    TypecheckCommand: "pnpm typecheck",
    TrackedTypeFile: TRACKED_REL,
    TrackedChecksumBefore: trackedChecksumBefore,
    WorkingTreeCleanBefore: statusBefore.trim() === "",
  };

  try {
    assertSupabaseReachable();

    tempDir = mkdtempSync(join(tmpdir(), "db-types-compat-"));
    const rawPath = join(tempDir, "database.types.raw.ts");
    const formattedPath = join(tempDir, "database.types.formatted.ts");
    const backupPath = join(tempDir, "database.types.tracked.backup.ts");

    copyFileSync(TRACKED, backupPath);

    generateCanonical(rawPath);
    if (statSync(rawPath).size === 0) {
      harnessError("canonical type generation produced an empty file");
    }
    const rawChecksum = sha256File(rawPath);
    summary.GeneratedRawChecksum = rawChecksum;

    copyFileSync(rawPath, formattedPath);
    formatGenerated(formattedPath);
    const formattedChecksum = sha256File(formattedPath);
    summary.GeneratedFormattedChecksum = formattedChecksum;

    const formattedStat = statSync(formattedPath);
    if (formattedStat.size < 100) {
      harnessError("formatted generated types file is implausibly small");
    }
    const formattedText = readFileSync(formattedPath, "utf8");
    if (
      !formattedText.includes("export type Database") &&
      !formattedText.includes("export type Json")
    ) {
      harnessError("formatted generated types lack expected Database/Json exports");
    }

    // Substitute tracked file
    copyFileSync(formattedPath, TRACKED);
    substituted = true;

    const tc = runTypecheck();
    summary.TypecheckExitCode = tc.exitCode;
    const parsed = parseTypecheckDiagnostics(tc.combined);
    summary.DiagnosticCount = parsed.diagnosticCount;
    summary.AffectedFileCount = parsed.files.length;
    summary.DiagnosticCodeDistribution = parsed.codes;

    if (opts.expectErrors != null) {
      summary.ExpectedErrors = opts.expectErrors;
      summary.ExpectedErrorsMatch = parsed.diagnosticCount === opts.expectErrors;
      if (parsed.diagnosticCount !== opts.expectErrors) {
        summary.ExpectedErrorsNote = `baseline comparison: expected ${opts.expectErrors} diagnostics, observed ${parsed.diagnosticCount}`;
      }
    }

    if (tc.exitCode === 0) {
      summary.Status = "COMPATIBLE";
    } else {
      summary.Status = "INCOMPATIBLE";
    }

    return {
      status: summary.Status,
      exitCode: tc.exitCode === 0 ? EXIT.COMPATIBLE : EXIT.INCOMPATIBLE,
      summary,
      diagnostics: parsed,
    };
  } finally {
    // Always restore tracked file if we substituted or if it diverged
    try {
      const current = existsSync(TRACKED) ? readFileSync(TRACKED) : null;
      if (!current || !current.equals(trackedBytesBefore)) {
        writeFileSync(TRACKED, trackedBytesBefore);
      }
      substituted = false;
    } catch (restoreErr) {
      console.error(
        "[verify-database-types-compatibility] CRITICAL: failed to restore tracked types:",
        restoreErr,
      );
      try {
        writeFileSync(TRACKED, trackedBytesBefore);
      } catch {
        // last resort exhausted
      }
    }

    if (tempDir && existsSync(tempDir)) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error("[verify-database-types-compatibility] temp cleanup failed:", cleanupErr);
      }
    }

    // Integrity checks (also when try block threw)
    try {
      const afterChecksum = sha256File(TRACKED);
      summary.TrackedChecksumAfter = afterChecksum;
      summary.TrackedChecksumRestored = afterChecksum === trackedChecksumBefore;
      if (afterChecksum !== trackedChecksumBefore) {
        // attempt one more restore
        writeFileSync(TRACKED, trackedBytesBefore);
        const retry = sha256File(TRACKED);
        summary.TrackedChecksumAfter = retry;
        summary.TrackedChecksumRestored = retry === trackedChecksumBefore;
        if (retry !== trackedChecksumBefore) {
          summary.Status = "HARNESS_ERROR";
          summary.RestoreFailure = true;
        }
      }

      const statusAfter = gitStatusPorcelain();
      summary.WorkingTreeCleanAfter = statusAfter.trim() === "";
      summary.WorkingTreeStatusUnchanged = statusAfter === statusBefore;
      summary.WorkingTreeRestored = statusAfter === statusBefore;
      summary.TemporaryResourcesCleaned = !(tempDir && existsSync(tempDir));

      if (statusAfter !== statusBefore) {
        summary.Status = "HARNESS_ERROR";
        summary.WorkingTreeDrift = statusAfter;
      }
    } catch (integrityErr) {
      summary.Status = "HARNESS_ERROR";
      summary.IntegrityError =
        integrityErr instanceof Error ? integrityErr.message : String(integrityErr);
    }
  }
}

function parseArgs(argv) {
  /** @type {{ expectErrors: number | null }} */
  const opts = { expectErrors: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // pnpm may forward a bare "--" separator
    if (a === "--") continue;
    if (a === "--expect-errors") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 0) {
        harnessError("--expect-errors requires a non-negative number");
      }
      opts.expectErrors = n;
    } else if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/verify-database-types-compatibility.mjs [--expect-errors N]

Exit codes: 0 COMPATIBLE, 2 INCOMPATIBLE, 1 HARNESS_ERROR`);
      process.exit(0);
    } else {
      harnessError(`unknown argument: ${a}`);
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  try {
    const result = runCompatibilityCheck(opts);
    printSummary(result.summary);
    if (result.summary.Status === "HARNESS_ERROR" || result.summary.RestoreFailure) {
      process.exit(EXIT.HARNESS_ERROR);
    }
    if (result.status === "COMPATIBLE") {
      console.log("[verify-database-types-compatibility] COMPATIBLE");
      process.exit(EXIT.COMPATIBLE);
    }
    console.log(
      `[verify-database-types-compatibility] INCOMPATIBLE (${result.summary.DiagnosticCount} diagnostics, ${result.summary.AffectedFileCount} files)`,
    );
    process.exit(EXIT.INCOMPATIBLE);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    printSummary({
      Status: "HARNESS_ERROR",
      Error: message,
      RepositoryHEAD: gitHead(),
      TrackedTypeFile: TRACKED_REL,
    });
    console.error("[verify-database-types-compatibility] HARNESS_ERROR:", message);
    process.exit(EXIT.HARNESS_ERROR);
  }
}

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main();
}
