/**
 * 4C2E-B2E — catalogue lifecycle application / repository / RPC seals.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

const MIGRATION = "supabase/migrations/20260803010000_measured_boq_catalogue_lifecycle_rpc.sql";
const REPO =
  "src/features/estimate/infrastructure/catalogue/measuredBoqCatalogueLifecycle.repository.server.ts";
const APPS = [
  "src/features/estimate/application/measuredBoq/publishMeasuredBoqCatalogueRevision.server.ts",
  "src/features/estimate/application/measuredBoq/retireMeasuredBoqCatalogueRevision.server.ts",
  "src/features/estimate/application/measuredBoq/rollbackMeasuredBoqCataloguePublication.server.ts",
];
const READER =
  "src/features/estimate/infrastructure/catalogue/measuredBoqCatalogue.repository.server.ts";
const PERSIST_APP =
  "src/features/estimate/application/measuredBoq/persistMeasuredBoqCatalogueDraft.server.ts";
const PERSIST_REPO =
  "src/features/estimate/infrastructure/catalogue/measuredBoqCataloguePersistence.repository.server.ts";

describe("catalogue lifecycle boundary (4C2E-B2E)", () => {
  it("lifecycle migration and modules exist", () => {
    assert.equal(exists(MIGRATION), true);
    assert.equal(exists(REPO), true);
    for (const app of APPS) assert.equal(exists(app), true, app);
  });

  it("migration defines exactly the three authorised lifecycle RPCs", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.publish_measured_boq_catalog_revision/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.retire_measured_boq_catalog_revision/);
    assert.match(
      sql,
      /CREATE OR REPLACE FUNCTION public\.rollback_measured_boq_catalog_publication/,
    );
    assert.match(sql, /SECURITY DEFINER/);
    assert.match(sql, /search_path = ''/);
    assert.match(sql, /OWNER TO postgres/);
    assert.match(sql, /GRANT EXECUTE[\s\S]*service_role/);
    assert.match(sql, /rollback-retire/);
    assert.doesNotMatch(sql, /republish_as_new|set_active|active_revision/);
    assert.doesNotMatch(sql, /GRANT EXECUTE[\s\S]*TO authenticated/);
    assert.doesNotMatch(sql, /GRANT EXECUTE[\s\S]*TO anon/);
  });

  it("lifecycle repository is one-RPC-per-method with no table DML", () => {
    const src = read(REPO);
    // Count live supabase.rpc invocations only (ignore prose in comments).
    assert.equal((src.match(/supabase\.rpc\s*\(/g) ?? []).length, 3);
    assert.match(src, /publish_measured_boq_catalog_revision/);
    assert.match(src, /retire_measured_boq_catalog_revision/);
    assert.match(src, /rollback_measured_boq_catalog_publication/);
    assert.doesNotMatch(src, /\.from\s*\(\s*["']measured_boq_catalog_/);
    assert.doesNotMatch(src, /persist_measured_boq_catalog_draft/);
    assert.doesNotMatch(src, /createBrowserClient|createBrowserSupabase/);
  });

  it("application use cases are server-only and do not auto-persist or pin", () => {
    for (const app of APPS) {
      const src = read(app);
      assert.match(app, /\.server\.ts$/);
      assert.doesNotMatch(src, /runCatalogueDryRun/);
      assert.doesNotMatch(src, /persistMeasuredBoqCatalogueDraft/);
      assert.doesNotMatch(src, /active_revision|set_active|republish_as_new/);
      assert.doesNotMatch(src, /createBrowserClient|from ["']@repo\/supabase\/browser["']/);
      assert.doesNotMatch(src, /@ts-expect-error|@ts-ignore|\bas any\b|as unknown as/);
    }
  });

  it("B2D persist does not auto-publish", () => {
    const app = read(PERSIST_APP);
    const repo = read(PERSIST_REPO);
    assert.doesNotMatch(app, /publish_measured_boq_catalog_revision/);
    assert.doesNotMatch(repo, /publish_measured_boq_catalog_revision/);
  });

  it("exact-revision reader remains unchanged in selection semantics", () => {
    const reader = read(READER);
    assert.match(reader, /latest\/current catalogue aliases are forbidden/);
    assert.doesNotMatch(reader, /\.eq\(["']catalog_revision["'],\s*["']latest["']\)/);
    assert.doesNotMatch(reader, /order\(["']published_at["']/);
    assert.doesNotMatch(reader, /publish_measured_boq_catalog|retire_measured_boq_catalog/);
  });

  it("no lifecycle operational catalogue package scripts", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
    const catalogueKeys = Object.keys(pkg.scripts ?? {})
      .filter((k) => /^catalogue:/i.test(k))
      .sort();
    assert.deepEqual(catalogueKeys, ["catalogue:dry-run", "catalogue:persist"]);
    assert.ok(pkg.scripts?.["verify:b2e:lifecycle-concurrency"]);
    assert.ok(pkg.scripts?.["verify:b2e:lifecycle-concurrency:test"]);
  });

  it("no browser/route imports of lifecycle modules", () => {
    const forbiddenRoots = ["src/routes", "src/components", "src/hooks"];
    for (const root of forbiddenRoots) {
      const abs = join(ROOT, root);
      if (!existsSync(abs)) continue;
      const stack = [abs];
      while (stack.length) {
        const dir = stack.pop()!;
        for (const ent of readdirSync(dir, { withFileTypes: true })) {
          const p = join(dir, ent.name);
          if (ent.isDirectory()) {
            stack.push(p);
            continue;
          }
          if (!/\.(ts|tsx)$/.test(ent.name)) continue;
          const src = readFileSync(p, "utf8");
          assert.doesNotMatch(
            src,
            /publishMeasuredBoqCatalogueRevision|retireMeasuredBoqCatalogueRevision|rollbackMeasuredBoqCataloguePublication|measuredBoqCatalogueLifecycle/,
            p,
          );
        }
      }
    }
  });
});
