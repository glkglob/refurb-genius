/**
 * 4C2E-B1C — catalogue dry-run CLI boundary seal (no database writes).
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

const CLI = "scripts/catalogue-dry-run.ts";
const PACKAGE_JSON = "package.json";
const SERVICES_INDEX = "packages/services/src/index.ts";
const MEASURED_BOQ_INDEX = "packages/services/src/measured-boq/index.ts";
const CATALOGUE_INDEX = "packages/services/src/measured-boq/catalogue/index.ts";
const REVISIONS_DIR = "catalogue-sources/measured-boq/revisions";
const EXAMPLE_DIR = `${REVISIONS_DIR}/mboq-2099.01.01`;
const EXAMPLE_MANIFEST = `${EXAMPLE_DIR}/MANIFEST.json`;
const EXAMPLE_SNAPSHOT = `${EXAMPLE_DIR}/snapshot.json`;

describe("catalogue dry-run CLI boundary (4C2E-B1C)", () => {
  it("CLI script exists", () => {
    assert.equal(exists(CLI), true);
  });

  it("only catalogue:dry-run package entry exists for catalogue tooling", () => {
    const pkg = JSON.parse(read(PACKAGE_JSON)) as { scripts?: Record<string, string> };
    const scripts = pkg.scripts ?? {};
    assert.equal(scripts["catalogue:dry-run"], "tsx scripts/catalogue-dry-run.ts");

    const catalogueScriptKeys = Object.keys(scripts).filter((k) => /catalogue|catalog/i.test(k));
    assert.deepEqual(catalogueScriptKeys, ["catalogue:dry-run"]);

    for (const [key, value] of Object.entries(scripts)) {
      assert.doesNotMatch(key, /catalogue:(import|publish|upsert|retire|write)/i);
      assert.doesNotMatch(value, /catalogue-(import|publish|upsert|retire)/i);
    }
  });

  it("CLI has no Supabase, service-role, env credentials, network, child_process, or write FS APIs", () => {
    const src = read(CLI);
    assert.doesNotMatch(src, /@supabase|createClient|createServerClient|createServiceRole/);
    assert.doesNotMatch(src, /SERVICE_ROLE|SUPABASE_/);
    assert.doesNotMatch(src, /process\.env/);
    assert.doesNotMatch(src, /\bfetch\s*\(/);
    assert.doesNotMatch(src, /XMLHttpRequest/);
    assert.doesNotMatch(src, /node:child_process|from ["']child_process["']/);
    assert.doesNotMatch(
      src,
      /\bwriteFile\b|\bappendFile\b|\bmkdir\b|\brmdir\b|\bunlink\b|\brename\b|\bcopyFile\b|\bcpSync\b|\brmSync\b/,
    );
    assert.doesNotMatch(src, /measuredBoqCatalogue\.repository/);
    assert.doesNotMatch(src, /from ["']node:fs["']/); // only fs/promises allowed
    assert.match(src, /node:fs\/promises/);
    assert.match(src, /readFile/);
  });

  it("CLI is not exported from services barrels", () => {
    const services = read(SERVICES_INDEX);
    const measured = read(MEASURED_BOQ_INDEX);
    const catalogue = read(CATALOGUE_INDEX);
    for (const src of [services, measured, catalogue]) {
      assert.doesNotMatch(src, /catalogue-dry-run/);
      assert.doesNotMatch(src, /from ["'].*scripts\//);
    }
  });

  it("CLI does not import feature or runtime repository modules", () => {
    const src = read(CLI);
    assert.doesNotMatch(src, /@\/features|src\/features/);
    assert.doesNotMatch(src, /repository\.server/);
    assert.doesNotMatch(src, /createServiceRoleSupabase/);
  });

  it("exactly one synthetic non-production example revision exists", () => {
    assert.equal(exists(REVISIONS_DIR), true);
    const revisions = readdirSync(join(ROOT, REVISIONS_DIR), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    assert.deepEqual(revisions, ["mboq-2099.01.01"]);

    assert.equal(exists(EXAMPLE_MANIFEST), true);
    assert.equal(exists(EXAMPLE_SNAPSHOT), true);

    const manifest = JSON.parse(read(EXAMPLE_MANIFEST)) as {
      catalogRevision?: string;
      source?: { licenceStatus?: string };
      package?: { production?: boolean; snapshotPath?: string };
    };
    assert.equal(manifest.catalogRevision, "mboq-2099.01.01");
    assert.equal(manifest.source?.licenceStatus, "synthetic");
    assert.equal(manifest.package?.production, false);
    assert.equal(manifest.package?.snapshotPath, "snapshot.json");

    const snapshot = JSON.parse(read(EXAMPLE_SNAPSHOT)) as {
      catalogRevision?: string;
      production?: boolean;
      sourceDescription?: string;
    };
    assert.equal(snapshot.catalogRevision, "mboq-2099.01.01");
    assert.equal(snapshot.production, false);
    assert.match(String(snapshot.sourceDescription ?? ""), /SYNTHETIC/i);
  });

  it("CLI reuses B1B runCatalogueDryRun and does not stub write modes", () => {
    const src = read(CLI);
    assert.match(src, /runCatalogueDryRun/);
    assert.match(src, /@repo\/services/);
    assert.doesNotMatch(src, /case\s+["']publish["']|case\s+["']upsert["']|case\s+["']retire["']/);
    // Prohibited --mode may appear only as a rejected flag name, not as a selectable option.
    assert.match(src, /PROHIBITED_FLAGS/);
    assert.doesNotMatch(src, /mode\s*[:=]\s*["'](publish|upsert|retire|import|write)["']/);
    assert.doesNotMatch(src, /args\.mode\b|parsed\.mode\b/);
  });
});
