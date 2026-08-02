#!/usr/bin/env node
/**
 * 4C2E-B2C1T-P1B6 — Complete-file canonical database-types verifier.
 *
 * Proves the tracked generated type file is byte-for-byte identical to a
 * fresh generate + format cycle against the local migration-built schema.
 *
 * Distinct from the compatibility harness (which asks whether the app
 * typechecks against canonical types). This gate asks whether the tracked
 * file *is* the complete canonical output.
 *
 * Exit codes:
 *   0 — tracked file equals freshly generated + formatted canonical output
 *   1 — generation, format, empty output, byte drift, tools, cleanup failure
 *
 * Usage:
 *   node scripts/verify-database-types-canonical.mjs
 *   pnpm verify:database-types:canonical
 *
 * Optional env (tests / controlled probes only):
 *   VERIFY_DB_TYPES_CANONICAL_INJECT_GEN=fail|empty|partial
 *   VERIFY_DB_TYPES_CANONICAL_INJECT_FORMAT=fail|bare
 *   VERIFY_DB_TYPES_CANONICAL_INJECT_CLEANUP=fail
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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TRACKED = join(ROOT, "packages/supabase/src/database.types.ts");
const TRACKED_REL = "packages/supabase/src/database.types.ts";

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
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  const err = new Error(message);
  // @ts-expect-error attach code for tests
  err.canonicalCode = "CANONICAL_VERIFY_ERROR";
  throw err;
}

function assertTools() {
  for (const cmd of ["git", "pnpm", "node"]) {
    try {
      execFileSync(cmd === "node" ? process.execPath : cmd, ["--version"], {
        stdio: "pipe",
      });
    } catch {
      fail(`required command not available: ${cmd}`);
    }
  }
  if (!existsSync(TRACKED)) {
    fail(`tracked type file missing: ${TRACKED_REL}`);
  }
}

function assertSupabaseReachable() {
  if (process.env.VERIFY_DB_TYPES_CANONICAL_INJECT_GEN) return;
  const res = spawnSync("pnpm", ["exec", "supabase", "status"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
  });
  if (res.status !== 0) {
    fail(
      "local Supabase is unavailable (pnpm exec supabase status failed). " +
        "Start it with `pnpm supabase:start` and retry.",
    );
  }
}

/**
 * @param {string} outPath
 */
function generateCanonical(outPath) {
  const inject = process.env.VERIFY_DB_TYPES_CANONICAL_INJECT_GEN;
  if (inject === "fail") {
    fail("injected generation failure");
  }
  if (inject === "empty") {
    writeFileSync(outPath, "", "utf8");
    return { raw: "", stderr: "injected empty" };
  }
  if (inject === "partial") {
    // Catalogue-only / trimmed surface — must never pass complete-file verification.
    const partial = `export type Json = string | number | boolean | null
export type Database = {
  public: {
    Tables: {
      measured_boq_catalog_revisions: {
        Row: {
          id: string
          catalog_revision: string
        }
        Insert: {
          id?: string
          catalog_revision: string
        }
        Update: {
          id?: string
          catalog_revision?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
`;
    writeFileSync(outPath, partial, "utf8");
    return { raw: partial, stderr: "injected partial" };
  }

  const res = spawnSync("pnpm", CANONICAL_GEN_ARGS, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, SUPABASE_DB_PASSWORD: "postgres" },
  });
  if (res.status !== 0) {
    fail(
      `canonical type generation failed (exit ${res.status}): ${res.stderr || res.stdout || "no output"}`,
    );
  }
  const raw = res.stdout ?? "";
  if (!raw.trim()) {
    fail("canonical type generation produced empty stdout");
  }
  if (!raw.includes("export type Database") && !raw.includes("export type Json")) {
    fail("canonical type generation output is not a plausible Database types file");
  }
  writeFileSync(outPath, raw, "utf8");
  return { raw, stderr: res.stderr ?? "" };
}

/**
 * @param {string} filePath
 */
function formatGenerated(filePath) {
  const inject = process.env.VERIFY_DB_TYPES_CANONICAL_INJECT_FORMAT;
  if (inject === "fail") {
    fail("injected formatter failure");
  }
  // Non-authoritative bare prettier — must not match project-formatted tracked file.
  if (inject === "bare") {
    const bare = spawnSync("pnpm", ["exec", "prettier", "--write", filePath], {
      cwd: ROOT,
      encoding: "utf8",
      env: process.env,
    });
    if (bare.status !== 0) {
      fail(
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
    fail(
      `prettier formatting failed (exit ${res.status}): ${res.stderr || res.stdout || "no output"}`,
    );
  }
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
 * @param {Record<string, unknown>} summary
 */
function printSummary(summary) {
  console.log("--- database-types-canonical ---");
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
 * @returns {{ exitCode: number, equal: boolean, summary: Record<string, unknown> }}
 */
export function runCanonicalVerify() {
  assertTools();
  assertSupabaseReachable();

  const statusBefore = gitStatusPorcelain();
  const trackedChecksum = sha256File(TRACKED);
  const trackedBytes = readFileSync(TRACKED);

  /** @type {Record<string, unknown>} */
  const summary = {
    Status: "FAIL",
    TrackedTypeFile: TRACKED_REL,
    TrackedChecksum: trackedChecksum,
    CanonicalCommand: CANONICAL_COMMAND,
    FormatterCommand: FORMATTER_COMMAND,
    ByteEquality: false,
    WorkingTreeStatusUnchanged: false,
    TemporaryResourcesCleaned: false,
  };

  let tempDir = "";
  /** @type {Error | null} */
  let deferredError = null;
  let equal = false;

  try {
    tempDir = mkdtempSync(join(tmpdir(), "db-types-canonical-"));
    const rawPath = join(tempDir, "database.types.raw.ts");
    const formattedPath = join(tempDir, "database.types.formatted.ts");

    generateCanonical(rawPath);
    if (!existsSync(rawPath) || statSync(rawPath).size === 0) {
      fail("canonical type generation produced an empty file");
    }

    copyFileSync(rawPath, formattedPath);
    formatGenerated(formattedPath);
    if (!existsSync(formattedPath) || statSync(formattedPath).size === 0) {
      fail("formatted canonical generation is empty");
    }

    const generatedChecksum = sha256File(formattedPath);
    summary.GeneratedChecksum = generatedChecksum;

    const generatedBytes = readFileSync(formattedPath);
    equal = trackedBytes.length === generatedBytes.length && trackedBytes.equals(generatedBytes);

    summary.ByteEquality = equal;

    // Guarantee we never rewrote the tracked file.
    const trackedAfter = readFileSync(TRACKED);
    if (!trackedBytes.equals(trackedAfter)) {
      fail("tracked type file was mutated during canonical verification");
    }

    if (!equal) {
      summary.Status = "DRIFT";
    } else {
      summary.Status = "PASS";
    }
  } catch (err) {
    deferredError = err instanceof Error ? err : new Error(String(err));
    summary.Status = "FAIL";
  } finally {
    const statusAfter = gitStatusPorcelain();
    summary.WorkingTreeStatusUnchanged = statusBefore === statusAfter;

    if (tempDir) {
      try {
        if (process.env.VERIFY_DB_TYPES_CANONICAL_INJECT_CLEANUP === "fail") {
          throw new Error("injected cleanup failure");
        }
        rmSync(tempDir, { recursive: true, force: true });
        summary.TemporaryResourcesCleaned = !existsSync(tempDir);
      } catch (cleanupErr) {
        summary.TemporaryResourcesCleaned = false;
        const msg = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
        if (!deferredError) {
          deferredError = new Error(msg);
        }
        summary.Status = "FAIL";
      }
    } else {
      summary.TemporaryResourcesCleaned = true;
    }

    if (statusBefore !== statusAfter && summary.Status === "PASS") {
      summary.Status = "FAIL";
      if (!deferredError) {
        deferredError = new Error("working-tree status changed during canonical verification");
      }
    }
  }

  printSummary(summary);

  if (deferredError) {
    throw deferredError;
  }

  if (!equal || summary.Status !== "PASS") {
    console.error(
      `[verify-database-types-canonical] DRIFT: tracked ${summary.TrackedChecksum} != generated ${summary.GeneratedChecksum}`,
    );
    return { exitCode: 1, equal: false, summary };
  }

  if (summary.WorkingTreeStatusUnchanged !== true) {
    console.error(
      "[verify-database-types-canonical] working-tree status changed during verification",
    );
    return { exitCode: 1, equal: true, summary };
  }

  if (summary.TemporaryResourcesCleaned !== true) {
    console.error("[verify-database-types-canonical] temporary resources not cleaned");
    return { exitCode: 1, equal: true, summary };
  }

  console.log("[verify-database-types-canonical] PASS (byte-equal)");
  return { exitCode: 0, equal: true, summary };
}

function main() {
  try {
    const result = runCanonicalVerify();
    process.exitCode = result.exitCode;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[verify-database-types-canonical] ERROR: ${message}`);
    process.exitCode = 1;
  }
}

const isMain =
  Boolean(process.argv[1]) && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
