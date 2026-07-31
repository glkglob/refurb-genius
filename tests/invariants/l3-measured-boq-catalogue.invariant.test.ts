/**
 * 4C2C-B — measured-BOQ catalogue foundation architecture invariants.
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

const MIGRATION = "supabase/migrations/20260731120000_measured_boq_catalogue_foundation.sql";
const LOADER =
  "src/features/estimate/infrastructure/catalogue/measuredBoqCatalogue.repository.server.ts";
const INFRA_BARREL = "src/features/estimate/infrastructure/index.ts";
const ENGINE = "packages/services/src/measured-boq/measuredBoqEngine.ts";
const SERVICES_CATALOGUE = "packages/services/src/measured-boq/catalogue";

describe("l3 measured-BOQ catalogue foundation", () => {
  it("migration exists with private catalogue tables and immutability", () => {
    assert.equal(exists(MIGRATION), true);
    const sql = read(MIGRATION);
    assert.match(sql, /measured_boq_catalog_revisions/);
    assert.match(sql, /measured_boq_catalog_entries/);
    assert.match(sql, /catalog_revision/);
    assert.doesNotMatch(sql, /\brevision_id\b/);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /REVOKE ALL ON TABLE public\.measured_boq_catalog_revisions FROM anon/);
    assert.match(
      sql,
      /REVOKE ALL ON TABLE public\.measured_boq_catalog_entries FROM authenticated/,
    );
    assert.match(sql, /measured_boq_catalog_revision_immutable/);
    assert.match(sql, /measured_boq_catalog_entry_parent_draft_only/);
    assert.match(sql, /measured_boq_catalog_assert_parent_draft/);
    assert.match(sql, /FOR SHARE/);
    assert.match(sql, /estimates_measured_header_integrity/);
    assert.match(sql, /estimates_catalog_revision_fkey/);
    assert.match(sql, /rate_source/);
    assert.match(sql, /estimate_items_catalog_entry_fkey/);
    assert.match(sql, /estimate_items_library_provenance_integrity/);
    assert.match(sql, /pricing_authority = 'none'/);
    assert.doesNotMatch(sql, /persist_measured_boq/i);
    assert.doesNotMatch(sql, /INSERT INTO public\.measured_boq_catalog_entries/);
  });

  it("catalogue loader is server-only and not browser-exported", () => {
    assert.equal(exists(LOADER), true);
    assert.match(LOADER, /\.server\.ts$/);
    const barrel = read(INFRA_BARREL);
    assert.doesNotMatch(barrel, /export \{[^}]*measuredBoqCatalogue/);
    assert.doesNotMatch(barrel, /from ["'].*catalogue\//);
    const loader = read(LOADER);
    assert.match(loader, /createServiceRoleSupabase/);
    assert.match(loader, /service\.server/);
    assert.match(loader, /latest\/current catalogue aliases are forbidden/);
    assert.doesNotMatch(loader, /\.eq\(["']catalog_revision["'],\s*["']latest["']\)/);
    assert.doesNotMatch(loader, /order\(["']published_at["']/);
    assert.match(loader, /MEASURED_BOQ_CATALOGUE_CACHE_MAX_ENTRIES/);
    assert.match(loader, /createMeasuredBoqLibraryResolverFromMap/);
    assert.match(loader, /Object\.freeze/);
    // Public LoadedCatalogueSnapshot must not expose a mutable Map field.
    const loadedTypeStart = loader.indexOf("export type LoadedCatalogueSnapshot");
    assert.ok(loadedTypeStart >= 0, "LoadedCatalogueSnapshot type missing");
    const loadedTypeEnd = loader.indexOf("};", loadedTypeStart);
    assert.ok(loadedTypeEnd > loadedTypeStart, "LoadedCatalogueSnapshot type unclosed");
    const loadedType = loader.slice(loadedTypeStart, loadedTypeEnd);
    assert.doesNotMatch(loadedType, /entriesByRateKey/);
    assert.match(loadedType, /resolveLibraryRate/);
    assert.match(loader, /CATALOG_ENTRY_PAGE_INCOMPLETE/);
    assert.match(loader, /AbortSignal\.timeout/);
  });

  it("@repo/services catalogue has no Supabase imports", () => {
    const files = readdirSync(join(ROOT, SERVICES_CATALOGUE)).filter((f) => f.endsWith(".ts"));
    for (const f of files) {
      if (f.endsWith(".test.ts")) continue;
      const src = read(join(SERVICES_CATALOGUE, f));
      assert.doesNotMatch(src, /@supabase|createClient|from\(['"]measured_boq/);
    }
  });

  it("engine catalogue entry carries unit and costType; library rate is identity-only", () => {
    const engine = read(ENGINE);
    assert.match(engine, /export type MeasuredBoqLibraryCatalogEntry/);
    assert.match(engine, /unit: string/);
    assert.match(engine, /costType: MeasuredBoqCostType/);
    assert.match(engine, /CATALOG_UNIT_MISMATCH/);
    assert.match(engine, /CATALOG_COST_TYPE_MISMATCH/);
    assert.match(engine, /libraryProvenance/);
    const start = engine.indexOf("export type MeasuredBoqLibraryRate =");
    const end = engine.indexOf("export type MeasuredBoqUserQuoteRate");
    assert.ok(start >= 0, "MeasuredBoqLibraryRate type marker missing");
    assert.ok(end >= 0, "MeasuredBoqUserQuoteRate type marker missing");
    assert.ok(end > start, "type markers out of order");
    const libraryRateBlock = engine.slice(start, end);
    assert.doesNotMatch(libraryRateBlock, /baseUnitRate|unitRate|money/);
    assert.match(libraryRateBlock, /rateKey: string/);
    assert.match(libraryRateBlock, /catalogRevision: string/);
  });

  it("mixed revisions are rejected by pure application code", () => {
    const gate = read(
      "packages/services/src/measured-boq/catalogue/assertSingleCatalogRevision.ts",
    );
    assert.match(gate, /MIXED_CATALOG_REVISIONS/);
    assert.doesNotMatch(gate, /@supabase|createClient/);
  });

  it("no measured persistence RPC or builder/reader cutover in 4C2C-B", () => {
    const sql = read(MIGRATION);
    assert.doesNotMatch(sql, /CREATE OR REPLACE FUNCTION public\.persist_measured/);
    assert.equal(exists("src/features/estimate/presentation/serverFns.ts"), true);
    const serverFns = read("src/features/estimate/presentation/serverFns.ts");
    assert.doesNotMatch(serverFns, /saveAuthorityMeasured|persistMeasuredBoq/);
  });

  it("no production rate files introduced", () => {
    assert.equal(exists("catalogue-sources/measured-boq/README.md"), true);
    const readme = read("catalogue-sources/measured-boq/README.md");
    assert.match(readme, /NOT APPROVED|not currently approved/i);
    const fixtures = readdirSync(join(ROOT, "tests/fixtures/measured-boq-catalogue"));
    assert.ok(fixtures.length >= 2);
    for (const f of fixtures) {
      const src = read(join("tests/fixtures/measured-boq-catalogue", f));
      assert.match(src, /SYNTHETIC|test-only|NOT product/i);
    }
  });

  it("4c2c types verifier script exists", () => {
    assert.equal(exists("scripts/verify-4c2c-database-types.mjs"), true);
    assert.equal(exists("scripts/probe-measured-boq-catalogue-4c2c.sql"), true);
  });
});
