#!/usr/bin/env tsx
/**
 * 4C2E-B1C — Measured-BOQ catalogue dry-run CLI (read-only).
 *
 * Composes the pure B1B pipeline from @repo/services. Owns only argv parsing,
 * safe filesystem reads, stdout/stderr formatting, and exit-code mapping.
 *
 * No Supabase, network, child processes, or write filesystem APIs.
 * Does not modify source packages. Does not publish, upsert, or retire.
 */

import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  runCatalogueDryRun,
  type CatalogueDryRunReport,
  type DryRunIssue,
  type RunCatalogueDryRunResult,
} from "@repo/services";

export const EXIT_OK = 0;
export const EXIT_VALIDATION = 1;
export const EXIT_INVOCATION = 2;
export const EXIT_CHECKSUM = 3;
export const EXIT_UNSUPPORTED = 4;
export const EXIT_INTERNAL = 5;

const PROHIBITED_FLAGS = new Set([
  "--mode",
  "--output",
  "--publish",
  "--upsert",
  "--retire",
  "--import",
  "--write",
  "--database",
  "--no-strict",
  "--supabase-url",
  "--service-role",
  "--force",
  "--yes",
]);

const SHA256_HEX = /^[0-9a-f]{64}$/;

export type CliArgs = {
  path: string;
  format: "text" | "json";
  expectedInputChecksum?: string;
  expectedOutputChecksum?: string;
  strict: boolean;
};

export type ParseArgsResult = { ok: true; args: CliArgs } | { ok: false; message: string };

/**
 * Parse CLI argv tokens (without node/tsx/script path).
 * Standalone `--` (pnpm passthrough separator) is ignored.
 */
export function parseArgs(argv: string[]): ParseArgsResult {
  const tokens = argv.filter((t) => t !== "--");

  if (tokens.length === 0) {
    return { ok: false, message: "missing required --path <revision-directory>" };
  }

  let pathValue: string | undefined;
  let format: "text" | "json" = "text";
  let expectedInputChecksum: string | undefined;
  let expectedOutputChecksum: string | undefined;
  let strict = false;

  const seen = new Set<string>();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;

    if (!token.startsWith("-")) {
      return { ok: false, message: `unexpected positional argument: ${token}` };
    }

    // Reject --flag=value forms for predictable parsing.
    if (token.includes("=")) {
      return { ok: false, message: `unsupported argument form: ${token}` };
    }

    if (PROHIBITED_FLAGS.has(token)) {
      return { ok: false, message: `prohibited flag: ${token}` };
    }

    if (token === "--strict") {
      if (seen.has("--strict")) {
        return { ok: false, message: "duplicate argument: --strict" };
      }
      seen.add("--strict");
      strict = true;
      continue;
    }

    const singletonKeys = [
      "--path",
      "--format",
      "--expected-input-checksum",
      "--expected-output-checksum",
    ] as const;
    if ((singletonKeys as readonly string[]).includes(token) && seen.has(token)) {
      return { ok: false, message: `duplicate argument: ${token}` };
    }

    const next = tokens[i + 1];
    const needsValue =
      token === "--path" ||
      token === "--format" ||
      token === "--expected-input-checksum" ||
      token === "--expected-output-checksum";

    if (needsValue) {
      if (next === undefined || next.startsWith("-")) {
        return { ok: false, message: `missing value for ${token}` };
      }
      i += 1;
      seen.add(token);

      if (token === "--path") {
        pathValue = next;
        continue;
      }
      if (token === "--format") {
        if (next !== "text" && next !== "json") {
          return { ok: false, message: `unsupported format: ${next}` };
        }
        format = next;
        continue;
      }
      if (token === "--expected-input-checksum") {
        if (!SHA256_HEX.test(next)) {
          return {
            ok: false,
            message: "malformed expected input checksum (require 64 lowercase hex)",
          };
        }
        expectedInputChecksum = next;
        continue;
      }
      if (token === "--expected-output-checksum") {
        if (!SHA256_HEX.test(next)) {
          return {
            ok: false,
            message: "malformed expected output checksum (require 64 lowercase hex)",
          };
        }
        expectedOutputChecksum = next;
        continue;
      }
    }

    return { ok: false, message: `unknown argument: ${token}` };
  }

  if (pathValue === undefined) {
    return { ok: false, message: "missing required --path <revision-directory>" };
  }

  return {
    ok: true,
    args: {
      path: pathValue,
      format,
      expectedInputChecksum,
      expectedOutputChecksum,
      strict,
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractSnapshotRelativePath(manifestText: string): string {
  try {
    const raw = JSON.parse(manifestText) as unknown;
    if (!isPlainObject(raw)) return "snapshot.json";
    const pkg = raw.package;
    if (!isPlainObject(pkg)) return "snapshot.json";
    if (typeof pkg.snapshotPath === "string" && pkg.snapshotPath !== "") {
      return pkg.snapshotPath;
    }
    if (typeof pkg.snapshot_path === "string" && pkg.snapshot_path !== "") {
      return pkg.snapshot_path;
    }
  } catch {
    // Malformed JSON is reported by the pure pipeline; default snapshot name for FS probe.
  }
  return "snapshot.json";
}

/** Sanitised containment failure — never include absolute or external paths. */
const CONTAINMENT_FAILURE = "Catalogue package artifact resolves outside the revision directory.";

/**
 * Effective-path containment: artifact real path must be a strict descendant of
 * the real revision root (never equal to the root; never outside).
 * Uses path.relative — not string startsWith — to avoid /tmp/revision vs
 * /tmp/revision-evil prefix confusion.
 */
export function isStrictlyInsideRoot(rootRealPath: string, artifactRealPath: string): boolean {
  const rel = relative(rootRealPath, artifactRealPath);
  return rel.length > 0 && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/**
 * Lexical snapshot path checks (absolute / ..) before realpath.
 */
function assertLexicalSnapshotRelative(
  snapshotRel: string,
): { ok: true; normalised: string } | { ok: false; message: string } {
  if (snapshotRel.includes("\0")) {
    return { ok: false, message: "unsafe snapshot path" };
  }
  if (isAbsolute(snapshotRel)) {
    return { ok: false, message: "snapshot path must be relative to the revision directory" };
  }
  const normalised = normalize(snapshotRel);
  const segments = normalised.split(/[/\\]/);
  if (segments.some((s) => s === "..")) {
    return { ok: false, message: "snapshot path must not contain parent-directory segments" };
  }
  if (normalised === ".." || normalised.startsWith(`..${sep}`) || normalised.startsWith("..\\")) {
    return { ok: false, message: "snapshot path must not escape the revision directory" };
  }
  return { ok: true, normalised };
}

export type LoadPackageResult =
  | { ok: true; manifestText: string; snapshotText: string }
  | { ok: false; message: string };

/**
 * Read-only load of MANIFEST.json + approved snapshot under a revision directory.
 *
 * Containment policy (effective paths):
 * - Resolve the revision root via realpath.
 * - Every package artifact (manifest + snapshot) is realpath'd and must be
 *   strictly inside that root before its content is read.
 * - Internal symlinks whose final real targets remain inside the root are
 *   allowed; external symlink targets are rejected without reading content.
 */
export async function loadRevisionPackage(pathArg: string): Promise<LoadPackageResult> {
  const revisionLexical = resolve(pathArg);

  let dirStat;
  try {
    dirStat = await stat(revisionLexical);
  } catch {
    return { ok: false, message: "revision directory not found or unreadable" };
  }
  if (!dirStat.isDirectory()) {
    return { ok: false, message: "path is not a directory" };
  }

  let revisionRootReal: string;
  try {
    revisionRootReal = await realpath(revisionLexical);
  } catch {
    return { ok: false, message: "revision directory not found or unreadable" };
  }

  // --- MANIFEST.json: realpath then contain, then read the verified real path ---
  const manifestLexical = join(revisionLexical, "MANIFEST.json");
  let manifestReal: string;
  try {
    manifestReal = await realpath(manifestLexical);
  } catch {
    return { ok: false, message: "MANIFEST.json missing or unreadable" };
  }
  if (!isStrictlyInsideRoot(revisionRootReal, manifestReal)) {
    return { ok: false, message: CONTAINMENT_FAILURE };
  }
  let manifestStat;
  try {
    manifestStat = await stat(manifestReal);
  } catch {
    return { ok: false, message: "MANIFEST.json missing or unreadable" };
  }
  if (!manifestStat.isFile()) {
    return { ok: false, message: "MANIFEST.json missing or unreadable" };
  }

  let manifestText: string;
  try {
    // Read the verified real path (not a different unresolved path).
    manifestText = await readFile(manifestReal, "utf8");
  } catch {
    return { ok: false, message: "MANIFEST.json missing or unreadable" };
  }

  // --- Snapshot: lexical checks, then realpath + contain, then read ---
  const snapshotRel = extractSnapshotRelativePath(manifestText);
  const lexical = assertLexicalSnapshotRelative(snapshotRel);
  if (!lexical.ok) {
    return lexical;
  }

  const snapshotLexical = resolve(revisionLexical, lexical.normalised);
  // Lexical prefix check relative to revision root (still not sufficient alone).
  const lexicalRel = relative(revisionLexical, snapshotLexical);
  if (
    lexicalRel.length === 0 ||
    lexicalRel === ".." ||
    lexicalRel.startsWith(`..${sep}`) ||
    isAbsolute(lexicalRel)
  ) {
    return { ok: false, message: CONTAINMENT_FAILURE };
  }

  let snapshotReal: string;
  try {
    snapshotReal = await realpath(snapshotLexical);
  } catch {
    // Missing file, dangling symlink, or unreadable link.
    return { ok: false, message: "snapshot file missing or unreadable" };
  }
  if (!isStrictlyInsideRoot(revisionRootReal, snapshotReal)) {
    return { ok: false, message: CONTAINMENT_FAILURE };
  }

  let snapshotStat;
  try {
    snapshotStat = await stat(snapshotReal);
  } catch {
    return { ok: false, message: "snapshot file missing or unreadable" };
  }
  if (!snapshotStat.isFile()) {
    return { ok: false, message: "snapshot file missing or unreadable" };
  }

  let snapshotText: string;
  try {
    snapshotText = await readFile(snapshotReal, "utf8");
  } catch {
    return { ok: false, message: "snapshot file missing or unreadable" };
  }

  return { ok: true, manifestText, snapshotText };
}

/**
 * Map a B1B dry-run report to process exit code.
 * Precedence: 4 (unsupported) > 3 (checksum) > 2 (JSON parse) > 1 (validation) > 0.
 */
export function mapExitCode(report: CatalogueDryRunReport): number {
  if (report.ok) return EXIT_OK;

  const codes = report.issues.map((i) => i.code);
  const has = (code: string) => codes.includes(code);

  if (has("MANIFEST_VERSION_UNSUPPORTED") || has("NORMALISER_VERSION_UNSUPPORTED")) {
    return EXIT_UNSUPPORTED;
  }
  if (has("INPUT_CHECKSUM_MISMATCH") || has("OUTPUT_CHECKSUM_MISMATCH")) {
    return EXIT_CHECKSUM;
  }
  if (has("JSON_PARSE_INVALID")) {
    return EXIT_INVOCATION;
  }
  return EXIT_VALIDATION;
}

function display(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return "(none)";
  return String(value);
}

function formatIssueLine(issue: DryRunIssue): string {
  return `- [${issue.code}] ${issue.path} — ${issue.message}`;
}

/**
 * Deterministic text report (exactly one trailing newline).
 */
export function formatReportText(report: CatalogueDryRunReport): string {
  const lines: string[] = [
    "Catalogue dry run",
    `Status: ${report.ok ? "PASS" : "FAIL"}`,
    `Mode: ${report.mode}`,
    `Manifest version: ${display(report.manifestVersion)}`,
    `Normaliser version: ${display(report.normaliserVersion)}`,
    `Catalogue revision: ${display(report.catalogRevision)}`,
    `Source: ${display(report.sourceId)}`,
    `Licence status: ${display(report.licenceStatus)}`,
    `Production: ${display(report.production)}`,
    `Records: ${report.recordCount}`,
    `Accepted: ${report.acceptedCount}`,
    `Rejected: ${report.rejectedCount}`,
    `Warnings: ${report.warningCount}`,
    `Input checksum: ${display(report.inputChecksum)}`,
    `Output checksum: ${display(report.outputChecksum)}`,
    `Unit alias applications: ${report.unitAliasApplications.length}`,
    "",
    "Issues:",
  ];

  if (report.issues.length === 0) {
    lines.push("- (none)");
  } else {
    for (const issue of report.issues) {
      lines.push(formatIssueLine(issue));
    }
  }

  lines.push("", "Warnings:");
  if (report.warnings.length === 0) {
    lines.push("- (none)");
  } else {
    for (const warning of report.warnings) {
      lines.push(formatIssueLine(warning));
    }
  }

  return `${lines.join("\n")}\n`;
}

/**
 * Deterministic JSON report with stable key order (exactly one trailing newline).
 */
export function formatReportJson(report: CatalogueDryRunReport): string {
  const ordered = {
    ok: report.ok,
    mode: report.mode,
    tool: report.tool,
    manifestVersion: report.manifestVersion,
    normaliserVersion: report.normaliserVersion,
    catalogRevision: report.catalogRevision,
    sourceId: report.sourceId,
    licenceStatus: report.licenceStatus,
    production: report.production,
    recordCount: report.recordCount,
    acceptedCount: report.acceptedCount,
    rejectedCount: report.rejectedCount,
    warningCount: report.warningCount,
    inputChecksum: report.inputChecksum,
    outputChecksum: report.outputChecksum,
    unitAliasApplications: report.unitAliasApplications.map((u) => ({
      path: u.path,
      from: u.from,
      to: u.to,
    })),
    issues: report.issues.map((i) => ({
      code: i.code,
      class: i.class,
      path: i.path,
      ...(i.recordIndex !== undefined ? { recordIndex: i.recordIndex } : {}),
      ...(i.rateKey !== undefined ? { rateKey: i.rateKey } : {}),
      message: i.message,
    })),
    warnings: report.warnings.map((i) => ({
      code: i.code,
      class: i.class,
      path: i.path,
      ...(i.recordIndex !== undefined ? { recordIndex: i.recordIndex } : {}),
      ...(i.rateKey !== undefined ? { rateKey: i.rateKey } : {}),
      message: i.message,
    })),
  };
  return `${JSON.stringify(ordered)}\n`;
}

export function formatReport(report: CatalogueDryRunReport, format: "text" | "json"): string {
  return format === "json" ? formatReportJson(report) : formatReportText(report);
}

export type CliRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  report?: CatalogueDryRunReport;
};

/**
 * Full CLI evaluation (pure side-effect free aside from filesystem reads).
 */
export async function evaluateCli(argv: string[]): Promise<CliRunResult> {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    return { exitCode: EXIT_INVOCATION, stdout: "", stderr: `${parsed.message}\n` };
  }

  // --strict is an explicit affirmation only; validation is always strict.
  void parsed.args.strict;

  const loaded = await loadRevisionPackage(parsed.args.path);
  if (!loaded.ok) {
    return { exitCode: EXIT_INVOCATION, stdout: "", stderr: `${loaded.message}\n` };
  }

  let pipeline: RunCatalogueDryRunResult;
  try {
    pipeline = runCatalogueDryRun({
      manifestText: loaded.manifestText,
      snapshotText: loaded.snapshotText,
      expectedInputChecksum: parsed.args.expectedInputChecksum,
      expectedOutputChecksum: parsed.args.expectedOutputChecksum,
    });
  } catch {
    return {
      exitCode: EXIT_INTERNAL,
      stdout: "",
      stderr: "unexpected internal error during catalogue dry-run evaluation\n",
    };
  }

  const report = pipeline.report;
  const exitCode = mapExitCode(report);
  return {
    exitCode,
    stdout: formatReport(report, parsed.args.format),
    stderr: "",
    report,
  };
}

async function main(): Promise<void> {
  // Drop node + tsx + script path.
  const argv = process.argv.slice(2);
  try {
    const result = await evaluateCli(argv);
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exitCode = result.exitCode;
  } catch {
    process.stderr.write("unexpected internal error\n");
    process.exitCode = EXIT_INTERNAL;
  }
}

const invokedAsCli =
  typeof process.argv[1] === "string" &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedAsCli) {
  void main();
}
