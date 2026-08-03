/**
 * 4C2E-B2D1 — focused operational CLI coverage for catalogue:persist.
 *
 * Process-level and pure parseArgs tests. Does not require a live database for
 * validation/invocation paths; persistence-success paths mock the application command.
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const CLI_REL = "scripts/catalogue-persist.ts";
const EXAMPLE = "catalogue-sources/measured-boq/revisions/mboq-2099.01.01";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
  vi.restoreAllMocks();
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

describe("catalogue-persist parseArgs", async () => {
  const { parseArgs, EXIT_INVOCATION } = await import("./catalogue-persist.ts");

  it("requires --path", () => {
    const r = parseArgs([]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/missing required --path/);
  });

  it("accepts explicit request id", () => {
    const r = parseArgs([
      "--path",
      EXAMPLE,
      "--request-id",
      "11111111-1111-4111-8111-111111111111",
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.args.requestId).toBe("11111111-1111-4111-8111-111111111111");
      expect(r.args.path).toBe(EXAMPLE);
      expect(r.args.format).toBe("json");
    }
  });

  it("generates request id when omitted", () => {
    const r = parseArgs(["--path", EXAMPLE]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.args.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    }
  });

  it("rejects invalid UUID request id", () => {
    const r = parseArgs(["--path", EXAMPLE, "--request-id", "not-a-uuid"]);
    expect(r.ok).toBe(false);
  });

  it("accepts --format text and json", () => {
    const t = parseArgs(["--path", EXAMPLE, "--format", "text"]);
    const j = parseArgs(["--path", EXAMPLE, "--format", "json"]);
    expect(t.ok && t.args.format === "text").toBe(true);
    expect(j.ok && j.args.format === "json").toBe(true);
  });

  it("rejects prohibited lifecycle flags", () => {
    for (const flag of ["--publish", "--retire", "--rollback", "--activate"]) {
      const r = parseArgs(["--path", EXAMPLE, flag]);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/prohibited flag/);
    }
  });

  it("EXIT_INVOCATION is non-zero", () => {
    expect(EXIT_INVOCATION).toBeGreaterThan(0);
  });
});

describe("catalogue-persist CLI process", () => {
  it("missing path exits non-zero with stable invocation error", () => {
    const r = runCli([]);
    expect(r.status).toBe(2);
    const err = JSON.parse(r.stderr);
    expect(err.ok).toBe(false);
    expect(err.code).toBe("INVOCATION_ERROR");
    expect(r.stdout).toBe("");
  });

  it("missing artefact directory exits non-zero", () => {
    const r = runCli(["--path", "/tmp/does-not-exist-b2d1-catalogue"]);
    expect(r.status).toBe(2);
    const err = JSON.parse(r.stderr);
    expect(err.ok).toBe(false);
    expect(err.code).toBe("INVOCATION_ERROR");
    expect(err.message).toMatch(/not found|directory/i);
  });

  it("missing MANIFEST/snapshot exits non-zero", () => {
    const dir = makeTempDir("b2d1-empty-");
    const r = runCli(["--path", dir]);
    expect(r.status).toBe(2);
    const err = JSON.parse(r.stderr);
    expect(err.ok).toBe(false);
    expect(err.message).toMatch(/MANIFEST\.json and snapshot\.json/);
  });

  it("realpath escape via symlink is rejected", () => {
    const root = makeTempDir("b2d1-link-");
    const pkg = join(root, "pkg");
    mkdirSync(pkg);
    const outside = makeTempDir("b2d1-out-");
    writeFileSync(join(outside, "MANIFEST.json"), "{}");
    writeFileSync(join(outside, "snapshot.json"), "{}");
    symlinkSync(join(outside, "MANIFEST.json"), join(pkg, "MANIFEST.json"));
    symlinkSync(join(outside, "snapshot.json"), join(pkg, "snapshot.json"));
    const r = runCli(["--path", pkg]);
    expect(r.status).toBe(2);
    const err = JSON.parse(r.stderr);
    expect(err.message).toMatch(/strictly inside/i);
  });

  it("invalid JSON package yields validation failure non-zero and no raw dump", () => {
    const dir = makeTempDir("b2d1-bad-");
    const pkg = join(dir, "pkg");
    mkdirSync(pkg);
    writeFileSync(join(pkg, "MANIFEST.json"), "{not-json");
    writeFileSync(join(pkg, "snapshot.json"), "{not-json");
    const r = runCli([
      "--path",
      pkg,
      "--request-id",
      "11111111-1111-4111-8111-111111111111",
      "--format",
      "json",
    ]);
    expect(r.status).toBe(1);
    const err = JSON.parse(r.stderr);
    expect(err.ok).toBe(false);
    expect(err.code).toBe("VALIDATION_FAILED");
    expect(err.requestId).toBe("11111111-1111-4111-8111-111111111111");
    // No raw artefact dump
    expect(r.stdout + r.stderr).not.toContain("{not-json");
    expect(r.stdout + r.stderr).not.toMatch(/SERVICE_ROLE|eyJhbGciOi/);
  });

  it("production package is blocked with non-zero exit", () => {
    const dir = makeTempDir("b2d1-prod-");
    const pkg = join(dir, "pkg");
    cpSync(join(ROOT, EXAMPLE), pkg, { recursive: true });
    const manifestPath = join(pkg, "MANIFEST.json");
    const snapshotPath = join(pkg, "snapshot.json");
    writeFileSync(
      manifestPath,
      readFileSync(manifestPath, "utf8").replace('"production": false', '"production": true'),
    );
    writeFileSync(
      snapshotPath,
      readFileSync(snapshotPath, "utf8").replace('"production": false', '"production": true'),
    );
    const r = runCli([
      "--path",
      pkg,
      "--request-id",
      "11111111-1111-4111-8111-111111111111",
      "--format",
      "json",
    ]);
    expect(r.status).toBe(1);
    const err = JSON.parse(r.stderr);
    expect(err.ok).toBe(false);
    expect(err.code).toBe("PRODUCTION_BLOCKED");
  });

  it("text format validation failure uses key=value lines", () => {
    const dir = makeTempDir("b2d1-text-");
    const pkg = join(dir, "pkg");
    mkdirSync(pkg);
    writeFileSync(join(pkg, "MANIFEST.json"), "{bad");
    writeFileSync(join(pkg, "snapshot.json"), "{bad");
    const r = runCli([
      "--path",
      pkg,
      "--format",
      "text",
      "--request-id",
      "11111111-1111-4111-8111-111111111111",
    ]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/ok=false/);
    expect(r.stderr).toMatch(/code=VALIDATION_FAILED/);
  });

  it("source has no direct Supabase, DML, or lifecycle RPC", () => {
    const src = readFileSync(join(ROOT, CLI_REL), "utf8");
    expect(src).toMatch(/persistMeasuredBoqCatalogueDraft/);
    expect(src).not.toMatch(/@supabase|createClient|createServiceRole/);
    expect(src).not.toMatch(/\.from\s*\(\s*["']measured_boq_catalog_/);
    expect(src).not.toMatch(/publish_measured_boq|retire_measured_boq|rollback_measured/);
    expect(src).not.toMatch(/catalogue-dry-run/);
    // Single application command invocation site
    expect((src.match(/persistMeasuredBoqCatalogueDraft\s*\(/g) ?? []).length).toBe(1);
  });

  it("package scripts keep dry-run and persist separate", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["catalogue:dry-run"]).toBe("tsx scripts/catalogue-dry-run.ts");
    expect(pkg.scripts["catalogue:persist"]).toBe("tsx scripts/catalogue-persist.ts");
    expect(pkg.scripts["catalogue:dry-run"]).not.toContain("catalogue-persist");
    expect(pkg.scripts["catalogue:persist"]).not.toContain("catalogue-dry-run");
  });
});
