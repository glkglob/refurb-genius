/**
 * 4C2E-B2D — catalogue persist CLI / application boundary seals.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function exists(rel: string): boolean {
  return existsSync(join(ROOT, rel));
}

const CLI = "scripts/catalogue-persist.ts";
const APP =
  "src/features/estimate/application/measuredBoq/persistMeasuredBoqCatalogueDraft.server.ts";
const REPO =
  "src/features/estimate/infrastructure/catalogue/measuredBoqCataloguePersistence.repository.server.ts";

describe("catalogue persist boundary (4C2E-B2D)", () => {
  it("CLI and application modules exist", () => {
    assert.equal(exists(CLI), true);
    assert.equal(exists(APP), true);
    assert.equal(exists(REPO), true);
  });

  it("repository performs exactly one RPC and no direct catalogue table DML", () => {
    const src = read(REPO);
    assert.match(src, /persist_measured_boq_catalog_draft/);
    assert.equal((src.match(/\.rpc\s*\(/g) ?? []).length, 1);
    assert.doesNotMatch(src, /\.from\s*\(\s*["']measured_boq_catalog_/);
    assert.doesNotMatch(src, /publish_measured_boq_catalog|retire_measured_boq_catalog/);
  });

  it("application command runs B1 dry-run before repository call", () => {
    const src = read(APP);
    assert.match(src, /runCatalogueDryRun/);
    assert.match(src, /persistMeasuredBoqCatalogueDraftRpc/);
    assert.doesNotMatch(src, /publish_measured_boq_catalog|retire_measured_boq_catalog/);
  });

  it("CLI is separate from dry-run and forbids lifecycle flags", () => {
    const src = read(CLI);
    assert.match(src, /persistMeasuredBoqCatalogueDraft/);
    assert.doesNotMatch(src, /catalogue-dry-run/);
    assert.match(src, /PROHIBITED_FLAGS/);
    assert.doesNotMatch(src, /\.from\s*\(\s*["']measured_boq_catalog_/);
    assert.doesNotMatch(src, /publish_measured_boq_catalog|retire_measured_boq_catalog/);
  });

  it("package scripts expose only dry-run and persist catalogue commands", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
    const keys = Object.keys(pkg.scripts ?? {})
      .filter((k) => /catalogue|catalog/i.test(k))
      .sort();
    assert.deepEqual(keys, ["catalogue:dry-run", "catalogue:persist"]);
  });
});
