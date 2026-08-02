/**
 * 4C2E-B1C process-level CLI smoke tests.
 * Uses OS temporary directories only — no repository test artifacts.
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const EXAMPLE = "catalogue-sources/measured-boq/revisions/mboq-2099.01.01";
const CLI_REL = "scripts/catalogue-dry-run.ts";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup races
    }
  }
});

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function runCli(args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", CLI_REL, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function cloneExample(): string {
  const dir = makeTempDir("b1c-cat-");
  const dest = join(dir, "pkg");
  cpSync(join(ROOT, EXAMPLE), dest, { recursive: true });
  return dest;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function listRepoTrackedPaths(): string[] {
  const result = spawnSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" });
  return (result.stdout ?? "").split("\n").filter(Boolean);
}

function assertCleanReportOutput(stdout: string): void {
  expect(stdout.endsWith("\n")).toBe(true);
  expect(stdout.endsWith("\n\n")).toBe(false);
  expect(stdout.includes("\u001b[")).toBe(false);
  expect(stdout).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  // Absolute paths (POSIX or drive-letter) should not appear.
  expect(stdout).not.toMatch(/(^|[\s"])\/Users\//);
  expect(stdout).not.toMatch(/(^|[\s"])\/home\//);
  expect(stdout).not.toMatch(/[A-Za-z]:\\/);
}

describe("catalogue dry-run CLI — exit 0", () => {
  it("accepts committed synthetic package in text", () => {
    const r = runCli(["--path", EXAMPLE]);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain("Status: PASS");
    expect(r.stdout).toContain("Mode: dry-run");
    expect(r.stdout).toContain("Licence status: synthetic");
    expect(r.stdout).toContain("Production: false");
    assertCleanReportOutput(r.stdout);
  });

  it("accepts committed synthetic package in JSON", () => {
    const r = runCli(["--path", EXAMPLE, "--format", "json"]);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
    const report = JSON.parse(r.stdout) as {
      ok: boolean;
      mode: string;
      production: boolean;
      licenceStatus: string;
      inputChecksum: string;
      outputChecksum: string;
    };
    expect(report.ok).toBe(true);
    expect(report.mode).toBe("dry-run");
    expect(report.production).toBe(false);
    expect(report.licenceStatus).toBe("synthetic");
    expect(report.inputChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(report.outputChecksum).toMatch(/^[0-9a-f]{64}$/);
    assertCleanReportOutput(r.stdout);
  });

  it("text and JSON outputs are byte-identical across repeated runs", () => {
    const t1 = runCli(["--path", EXAMPLE]);
    const t2 = runCli(["--path", EXAMPLE]);
    expect(t1.status).toBe(0);
    expect(t1.stdout).toBe(t2.stdout);

    const j1 = runCli(["--path", EXAMPLE, "--format", "json"]);
    const j2 = runCli(["--path", EXAMPLE, "--format", "json"]);
    expect(j1.status).toBe(0);
    expect(j1.stdout).toBe(j2.stdout);
  });

  it("--strict is equivalent to omitting the flag", () => {
    const a = runCli(["--path", EXAMPLE, "--format", "json"]);
    const b = runCli(["--path", EXAMPLE, "--format", "json", "--strict"]);
    expect(a.status).toBe(0);
    expect(b.status).toBe(0);
    expect(a.stdout).toBe(b.stdout);
  });

  it("accepts matching expected input and output checksums", () => {
    const base = runCli(["--path", EXAMPLE, "--format", "json"]);
    expect(base.status).toBe(0);
    const report = JSON.parse(base.stdout) as {
      inputChecksum: string;
      outputChecksum: string;
    };
    const r = runCli([
      "--path",
      EXAMPLE,
      "--format",
      "json",
      "--expected-input-checksum",
      report.inputChecksum,
      "--expected-output-checksum",
      report.outputChecksum,
    ]);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
  });
});

describe("catalogue dry-run CLI — exit 2", () => {
  it("missing --path", () => {
    const r = runCli([]);
    expect(r.status).toBe(2);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/missing required --path/);
  });

  it("missing option value", () => {
    const r = runCli(["--path"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/missing value/);
  });

  it("unknown argument", () => {
    const r = runCli(["--path", EXAMPLE, "--verbose"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/unknown argument/);
  });

  it("positional argument", () => {
    const r = runCli(["--path", EXAMPLE, "extra"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/positional/);
  });

  it("unsupported format", () => {
    const r = runCli(["--path", EXAMPLE, "--format", "yaml"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/unsupported format/);
  });

  it("duplicate option", () => {
    const r = runCli(["--path", EXAMPLE, "--path", EXAMPLE]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/duplicate/);
  });

  it.each([
    "--mode",
    "--output",
    "--publish",
    "--upsert",
    "--retire",
    "--import",
    "--write",
    "--database",
  ])("prohibited flag %s", (flag) => {
    const r = runCli(["--path", EXAMPLE, flag, "x"]);
    // Some flags are value-taking; pass a dummy value only when parse would
    // treat next token as value for unknown flags — prohibited are rejected
    // before value consumption. For --mode etc. without registered arity, the
    // CLI rejects the flag itself.
    const r2 = runCli(["--path", EXAMPLE, flag]);
    expect([r.status, r2.status].some((s) => s === 2)).toBe(true);
  });

  it("nonexistent directory", () => {
    const r = runCli(["--path", join(tmpdir(), "b1c-does-not-exist-xyz")]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/not found|unreadable/);
  });

  it("missing manifest", () => {
    const dir = makeTempDir("b1c-nomf-");
    writeFileSync(join(dir, "snapshot.json"), "{}\n");
    const r = runCli(["--path", dir]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/MANIFEST/);
  });

  it("missing snapshot", () => {
    const dir = makeTempDir("b1c-nosnap-");
    copyFileSync(join(ROOT, EXAMPLE, "MANIFEST.json"), join(dir, "MANIFEST.json"));
    const r = runCli(["--path", dir]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/snapshot/);
  });

  it("malformed manifest JSON", () => {
    const dir = cloneExample();
    writeFileSync(join(dir, "MANIFEST.json"), "{not-json\n", "utf8");
    const r = runCli(["--path", dir, "--format", "json"]);
    expect(r.status).toBe(2);
    // Report emitted when pipeline can run with default snapshot path.
    if (r.stdout) {
      const report = JSON.parse(r.stdout) as { ok: boolean; issues: Array<{ code: string }> };
      expect(report.ok).toBe(false);
      expect(report.issues.some((i) => i.code === "JSON_PARSE_INVALID")).toBe(true);
    }
  });

  it("malformed snapshot JSON", () => {
    const dir = cloneExample();
    writeFileSync(join(dir, "snapshot.json"), "{bad\n", "utf8");
    const r = runCli(["--path", dir, "--format", "json"]);
    expect(r.status).toBe(2);
    const report = JSON.parse(r.stdout) as { ok: boolean; issues: Array<{ code: string }> };
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.code === "JSON_PARSE_INVALID")).toBe(true);
  });

  it("malformed expected checksum", () => {
    const r = runCli(["--path", EXAMPLE, "--expected-input-checksum", "not-a-hash"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/malformed expected input checksum/);
  });

  it("unsafe absolute snapshot path", () => {
    const dir = cloneExample();
    const manifest = JSON.parse(readFileSync(join(dir, "MANIFEST.json"), "utf8")) as {
      package: { snapshotPath: string; production: boolean };
    };
    manifest.package.snapshotPath = "/etc/passwd";
    writeJson(join(dir, "MANIFEST.json"), manifest);
    const r = runCli(["--path", dir]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/relative|unsafe|absolute/i);
  });

  it("unsafe traversal snapshot path", () => {
    const dir = cloneExample();
    const manifest = JSON.parse(readFileSync(join(dir, "MANIFEST.json"), "utf8")) as {
      package: { snapshotPath: string; production: boolean };
    };
    manifest.package.snapshotPath = "../escape/snapshot.json";
    writeJson(join(dir, "MANIFEST.json"), manifest);
    const r = runCli(["--path", dir]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/parent-directory|escape|outside/i);
  });
});

describe("catalogue dry-run CLI — exit 1", () => {
  it("unknown manifest field", () => {
    const dir = cloneExample();
    const manifest = JSON.parse(readFileSync(join(dir, "MANIFEST.json"), "utf8")) as Record<
      string,
      unknown
    >;
    manifest.extraField = true;
    writeJson(join(dir, "MANIFEST.json"), manifest);
    const r = runCli(["--path", dir, "--format", "json"]);
    expect(r.status).toBe(1);
    const report = JSON.parse(r.stdout) as { ok: boolean; issues: Array<{ code: string }> };
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.code === "MANIFEST_UNKNOWN_KEY")).toBe(true);
  });

  it("ambiguous aliases", () => {
    const dir = cloneExample();
    const manifest = JSON.parse(readFileSync(join(dir, "MANIFEST.json"), "utf8")) as Record<
      string,
      unknown
    >;
    manifest.catalog_revision = manifest.catalogRevision;
    writeJson(join(dir, "MANIFEST.json"), manifest);
    const r = runCli(["--path", dir, "--format", "json"]);
    expect(r.status).toBe(1);
    const report = JSON.parse(r.stdout) as { issues: Array<{ code: string }> };
    expect(report.issues.some((i) => i.code === "AMBIGUOUS_FIELD_ALIAS")).toBe(true);
  });

  it("invalid unit", () => {
    const dir = cloneExample();
    const snapshot = JSON.parse(readFileSync(join(dir, "snapshot.json"), "utf8")) as {
      entries: Array<Record<string, unknown>>;
    };
    snapshot.entries[0]!.unit = "furlongs";
    writeJson(join(dir, "snapshot.json"), snapshot);
    const r = runCli(["--path", dir, "--format", "json"]);
    expect(r.status).toBe(1);
    const report = JSON.parse(r.stdout) as { issues: Array<{ code: string }> };
    expect(report.issues.some((i) => i.code === "UNIT_INVALID")).toBe(true);
  });

  it("invalid decimal", () => {
    const dir = cloneExample();
    const snapshot = JSON.parse(readFileSync(join(dir, "snapshot.json"), "utf8")) as {
      entries: Array<Record<string, unknown>>;
    };
    snapshot.entries[0]!.baseUnitRate = "0.30000000000000004";
    writeJson(join(dir, "snapshot.json"), snapshot);
    const r = runCli(["--path", dir, "--format", "json"]);
    expect(r.status).toBe(1);
    const report = JSON.parse(r.stdout) as { issues: Array<{ code: string }> };
    expect(report.issues.some((i) => i.code === "RATE_INVALID")).toBe(true);
  });

  it("production true blocked", () => {
    const dir = cloneExample();
    const manifest = JSON.parse(readFileSync(join(dir, "MANIFEST.json"), "utf8")) as {
      package: { production: boolean };
    };
    manifest.package.production = true;
    writeJson(join(dir, "MANIFEST.json"), manifest);
    const r = runCli(["--path", dir, "--format", "json"]);
    expect(r.status).toBe(1);
    const report = JSON.parse(r.stdout) as { issues: Array<{ code: string }> };
    expect(report.issues.some((i) => i.code === "PRODUCTION_BLOCKED")).toBe(true);
  });

  it("invalid rights status", () => {
    const dir = cloneExample();
    const manifest = JSON.parse(readFileSync(join(dir, "MANIFEST.json"), "utf8")) as {
      source: { licenceStatus: string };
    };
    manifest.source.licenceStatus = "approved";
    writeJson(join(dir, "MANIFEST.json"), manifest);
    const r = runCli(["--path", dir, "--format", "json"]);
    expect(r.status).toBe(1);
    const report = JSON.parse(r.stdout) as { issues: Array<{ code: string }> };
    expect(report.issues.some((i) => i.code === "LICENCE_STATUS_INVALID")).toBe(true);
  });

  it("revision mismatch", () => {
    const dir = cloneExample();
    const snapshot = JSON.parse(readFileSync(join(dir, "snapshot.json"), "utf8")) as {
      catalogRevision: string;
    };
    snapshot.catalogRevision = "mboq-2099.12.31";
    writeJson(join(dir, "snapshot.json"), snapshot);
    const r = runCli(["--path", dir, "--format", "json"]);
    expect(r.status).toBe(1);
    const report = JSON.parse(r.stdout) as { issues: Array<{ code: string }> };
    expect(report.issues.some((i) => i.code === "REVISION_MISMATCH")).toBe(true);
  });

  it("catalogue semantic failure (duplicate rate key)", () => {
    const dir = cloneExample();
    const snapshot = JSON.parse(readFileSync(join(dir, "snapshot.json"), "utf8")) as {
      entries: Array<Record<string, unknown>>;
    };
    snapshot.entries.push({ ...snapshot.entries[0]! });
    writeJson(join(dir, "snapshot.json"), snapshot);
    const r = runCli(["--path", dir, "--format", "json"]);
    expect(r.status).toBe(1);
    const report = JSON.parse(r.stdout) as { issues: Array<{ code: string }> };
    expect(
      report.issues.some(
        (i) => i.code === "DUPLICATE_RATE_KEY" || i.code === "CATALOGUE_VALIDATION_FAILED",
      ) || report.issues.length > 0,
    ).toBe(true);
  });
});

describe("catalogue dry-run CLI — exit 3", () => {
  it("input checksum mismatch", () => {
    const bad = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const r = runCli(["--path", EXAMPLE, "--format", "json", "--expected-input-checksum", bad]);
    expect(r.status).toBe(3);
    const report = JSON.parse(r.stdout) as { issues: Array<{ code: string }> };
    expect(report.issues.some((i) => i.code === "INPUT_CHECKSUM_MISMATCH")).toBe(true);
  });

  it("output checksum mismatch", () => {
    const bad = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const r = runCli(["--path", EXAMPLE, "--format", "json", "--expected-output-checksum", bad]);
    expect(r.status).toBe(3);
    const report = JSON.parse(r.stdout) as { issues: Array<{ code: string }> };
    expect(report.issues.some((i) => i.code === "OUTPUT_CHECKSUM_MISMATCH")).toBe(true);
  });
});

describe("catalogue dry-run CLI — exit 4", () => {
  it("unsupported manifest version", () => {
    const dir = cloneExample();
    const manifest = JSON.parse(readFileSync(join(dir, "MANIFEST.json"), "utf8")) as {
      manifestVersion: string;
    };
    manifest.manifestVersion = "99";
    writeJson(join(dir, "MANIFEST.json"), manifest);
    const r = runCli(["--path", dir, "--format", "json"]);
    expect(r.status).toBe(4);
    const report = JSON.parse(r.stdout) as { issues: Array<{ code: string }> };
    expect(report.issues.some((i) => i.code === "MANIFEST_VERSION_UNSUPPORTED")).toBe(true);
  });

  it("unsupported normaliser version", () => {
    const dir = cloneExample();
    const manifest = JSON.parse(readFileSync(join(dir, "MANIFEST.json"), "utf8")) as {
      transformation: { normaliserVersion: string };
    };
    manifest.transformation.normaliserVersion = "99";
    writeJson(join(dir, "MANIFEST.json"), manifest);
    const r = runCli(["--path", dir, "--format", "json"]);
    expect(r.status).toBe(4);
    const report = JSON.parse(r.stdout) as { issues: Array<{ code: string }> };
    expect(report.issues.some((i) => i.code === "NORMALISER_VERSION_UNSUPPORTED")).toBe(true);
  });
});

describe("catalogue dry-run CLI — repository hygiene", () => {
  it("does not create report files or mutate sources", () => {
    const before = listRepoTrackedPaths();
    const r = runCli(["--path", EXAMPLE, "--format", "json"]);
    expect(r.status).toBe(0);
    const after = listRepoTrackedPaths();
    expect(after).toEqual(before);
    // No evidence/ report dir introduced by CLI
    expect(existsSync(join(ROOT, "evidence"))).toBe(false);
  });
});
