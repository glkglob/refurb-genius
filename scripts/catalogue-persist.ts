#!/usr/bin/env tsx
/**
 * 4C2E-B2D — Measured-BOQ catalogue draft persistence CLI.
 *
 * Reads raw package artefacts from a revision directory, runs the server-owned
 * application command, and prints stable machine-readable results.
 *
 * Separate from catalogue:dry-run. No publication/retirement. No raw artefact logging.
 */

import { randomUUID } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { persistMeasuredBoqCatalogueDraft } from "../src/features/estimate/application/measuredBoq/persistMeasuredBoqCatalogueDraft.server";

export const EXIT_OK = 0;
export const EXIT_VALIDATION = 1;
export const EXIT_INVOCATION = 2;
export const EXIT_CONFLICT = 3;
export const EXIT_PERSISTENCE = 4;
export const EXIT_INTERNAL = 5;

const PROHIBITED_FLAGS = new Set([
  "--publish",
  "--retire",
  "--rollback",
  "--activate",
  "--import",
  "--write",
  "--mode",
  "--no-strict",
  "--supabase-url",
  "--service-role",
  "--force",
  "--yes",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CliArgs = {
  path: string;
  requestId: string;
  format: "text" | "json";
};

export type ParseArgsResult = { ok: true; args: CliArgs } | { ok: false; message: string };

export function parseArgs(argv: string[]): ParseArgsResult {
  const tokens = argv.filter((t) => t !== "--");
  if (tokens.length === 0) {
    return { ok: false, message: "missing required --path <revision-directory>" };
  }

  let pathValue: string | undefined;
  let requestId: string | undefined;
  let format: "text" | "json" = "json";
  const seen = new Set<string>();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (!token.startsWith("-")) {
      return { ok: false, message: `unexpected positional argument: ${token}` };
    }
    if (token.includes("=")) {
      return { ok: false, message: `unsupported argument form: ${token}` };
    }
    if (PROHIBITED_FLAGS.has(token)) {
      return { ok: false, message: `prohibited flag: ${token}` };
    }

    if (token === "--path") {
      if (seen.has("--path")) return { ok: false, message: "duplicate argument: --path" };
      seen.add("--path");
      const value = tokens[++i];
      if (!value || value.startsWith("-")) {
        return { ok: false, message: "--path requires a directory value" };
      }
      pathValue = value;
      continue;
    }

    if (token === "--request-id") {
      if (seen.has("--request-id")) {
        return { ok: false, message: "duplicate argument: --request-id" };
      }
      seen.add("--request-id");
      const value = tokens[++i];
      if (!value || value.startsWith("-")) {
        return { ok: false, message: "--request-id requires a UUID value" };
      }
      if (!UUID_RE.test(value)) {
        return { ok: false, message: "--request-id must be a UUID" };
      }
      requestId = value;
      continue;
    }

    if (token === "--format") {
      if (seen.has("--format")) return { ok: false, message: "duplicate argument: --format" };
      seen.add("--format");
      const value = tokens[++i];
      if (value !== "text" && value !== "json") {
        return { ok: false, message: "--format must be text or json" };
      }
      format = value;
      continue;
    }

    return { ok: false, message: `unknown argument: ${token}` };
  }

  if (!pathValue) {
    return { ok: false, message: "missing required --path <revision-directory>" };
  }

  return {
    ok: true,
    args: {
      path: pathValue,
      requestId: requestId ?? randomUUID(),
      format,
    },
  };
}

function isStrictlyInsideRoot(rootReal: string, candidateReal: string): boolean {
  const rel = relative(rootReal, candidateReal);
  return rel !== "" && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

async function readPackageArtifacts(
  revisionPath: string,
): Promise<
  { ok: true; manifestText: string; snapshotText: string } | { ok: false; message: string }
> {
  const abs = resolve(process.cwd(), revisionPath);
  let rootReal: string;
  try {
    const st = await stat(abs);
    if (!st.isDirectory()) {
      return { ok: false, message: `--path must be a directory: ${revisionPath}` };
    }
    rootReal = await realpath(abs);
  } catch {
    return { ok: false, message: `revision directory not found: ${revisionPath}` };
  }

  const manifestCandidate = join(rootReal, "MANIFEST.json");
  const snapshotCandidate = join(rootReal, "snapshot.json");

  let manifestReal: string;
  let snapshotReal: string;
  try {
    manifestReal = await realpath(manifestCandidate);
    snapshotReal = await realpath(snapshotCandidate);
  } catch {
    return {
      ok: false,
      message: "revision directory must contain MANIFEST.json and snapshot.json",
    };
  }

  if (
    !isStrictlyInsideRoot(rootReal, manifestReal) ||
    !isStrictlyInsideRoot(rootReal, snapshotReal)
  ) {
    return {
      ok: false,
      message: "package artefacts must resolve strictly inside the revision directory",
    };
  }

  const manifestText = await readFile(manifestReal, "utf8");
  const snapshotText = await readFile(snapshotReal, "utf8");
  return { ok: true, manifestText, snapshotText };
}

function printResult(
  format: "text" | "json",
  payload: Record<string, unknown>,
  stream: "stdout" | "stderr" = "stdout",
): void {
  const target = stream === "stdout" ? console.log : console.error;
  if (format === "json") {
    target(JSON.stringify(payload));
    return;
  }
  for (const [k, v] of Object.entries(payload)) {
    target(`${k}=${typeof v === "string" ? v : JSON.stringify(v)}`);
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    printResult("json", { ok: false, code: "INVOCATION_ERROR", message: parsed.message }, "stderr");
    return EXIT_INVOCATION;
  }

  const artefacts = await readPackageArtifacts(parsed.args.path);
  if (!artefacts.ok) {
    printResult(
      parsed.args.format,
      {
        ok: false,
        code: "INVOCATION_ERROR",
        message: artefacts.message,
        requestId: parsed.args.requestId,
      },
      "stderr",
    );
    return EXIT_INVOCATION;
  }

  try {
    const result = await persistMeasuredBoqCatalogueDraft({
      manifestText: artefacts.manifestText,
      snapshotText: artefacts.snapshotText,
      requestId: parsed.args.requestId,
    });

    if (result.ok) {
      printResult(parsed.args.format, {
        ok: true,
        outcome: result.outcome,
        requestId: result.requestId,
        packageId: result.packageId,
        revisionId: result.revisionId,
        catalogRevision: result.catalogRevision,
        inputChecksum: result.inputChecksum,
        contentChecksum: result.contentChecksum,
        idempotentReplay: result.idempotentReplay,
      });
      return EXIT_OK;
    }

    const code = result.code;
    printResult(
      parsed.args.format,
      {
        ok: false,
        code,
        message: result.message,
        requestId: result.requestId ?? parsed.args.requestId,
        issues: result.issues,
      },
      "stderr",
    );

    if (
      code === "INVALID_REQUEST" ||
      code === "VALIDATION_FAILED" ||
      code === "PRODUCTION_BLOCKED"
    ) {
      return EXIT_VALIDATION;
    }
    if (
      code === "REQUEST_CONFLICT" ||
      code === "REVISION_CONFLICT" ||
      code === "PACKAGE_CONFLICT"
    ) {
      return EXIT_CONFLICT;
    }
    if (
      code === "PAYLOAD_TOO_LARGE" ||
      code === "PERSISTENCE_FAILED" ||
      code === "PERSISTENCE_UNAVAILABLE"
    ) {
      return EXIT_PERSISTENCE;
    }
    return EXIT_INTERNAL;
  } catch (err) {
    printResult(
      parsed.args.format,
      {
        ok: false,
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "internal error",
        requestId: parsed.args.requestId,
      },
      "stderr",
    );
    return EXIT_INTERNAL;
  }
}

const isMain =
  process.argv[1] &&
  normalize(resolve(process.argv[1])) === normalize(resolve(fileURLToPath(import.meta.url)));

if (isMain) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(
        JSON.stringify({
          ok: false,
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : "internal error",
        }),
      );
      process.exitCode = EXIT_INTERNAL;
    });
}
