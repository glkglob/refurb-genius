/**
 * 4C2D-B — measured-BOQ catalogue reader composition architecture invariants.
 *
 * Scans production composition source only. Negative probes use temporary
 * synthetic strings (not tracked production files).
 */
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../..");

function read(rel: string): string {
  const full = join(ROOT, rel);
  assert.ok(existsSync(full), `missing ${rel}`);
  return readFileSync(full, "utf8");
}

function exists(rel: string): boolean {
  return existsSync(join(ROOT, rel));
}

const COMPOSITION =
  "src/features/estimate/application/measuredBoq/repriceMeasuredBoqWithCatalogue.server.ts";
const APP_INDEX = "src/features/estimate/application/index.ts";
const ESTIMATE_INDEX = "src/features/estimate/index.ts";
const INFRA_INDEX = "src/features/estimate/infrastructure/index.ts";
const LOADER =
  "src/features/estimate/infrastructure/catalogue/measuredBoqCatalogue.repository.server.ts";
const REPRICE = "src/features/estimate/application/repriceMeasuredBoq.ts";

/** Strip block and line comments for lexical scans. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

// ── Positive production checks ─────────────────────────────────────────────

test("canonical composition module exists and is server-only by filename", () => {
  assert.equal(exists(COMPOSITION), true);
  assert.match(COMPOSITION, /\.server\.ts$/);
  const src = read(COMPOSITION);
  assert.match(src, /export async function repriceMeasuredBoqWithCatalogue/);
});

test("composition invokes assertSingleCatalogRevision before load", () => {
  const src = stripComments(read(COMPOSITION));
  assert.match(src, /assertSingleCatalogRevision\s*\(/);
  assert.match(src, /loadMeasuredBoqCatalogueSnapshot/);
  // Gate must appear before load call in source order
  const gateIdx = src.indexOf("assertSingleCatalogRevision");
  const loadIdx = src.indexOf("loadMeasuredBoqCatalogueSnapshot");
  assert.ok(gateIdx >= 0 && loadIdx >= 0, "gate and load markers missing");
  assert.ok(gateIdx < loadIdx, "assertSingleCatalogRevision must precede load in source");
  // Early return on gate failure
  assert.match(src, /if\s*\(\s*!gate\.ok\s*\)/);
});

test("composition loads exact catalogRevision and purpose, then repriceMeasuredBoq", () => {
  const src = stripComments(read(COMPOSITION));
  assert.match(src, /catalogRevision/);
  assert.match(src, /purpose/);
  assert.match(src, /repriceMeasuredBoq\s*\(/);
  assert.match(src, /resolveLibraryRate:\s*snapshot\.resolveLibraryRate/);
  assert.doesNotMatch(src, /["']latest["']/);
  assert.doesNotMatch(src, /["']current["']/);
});

test("composition has no category, trade, hard-coded rate map, or baseUnitRate construction", () => {
  const src = stripComments(read(COMPOSITION));
  assert.doesNotMatch(src, /CATEGORY_BASE/);
  assert.doesNotMatch(src, /runPricingEngine/);
  assert.doesNotMatch(src, /tradeRates|trade-rates|from\s+["'][^"']*tradeRates/);
  assert.doesNotMatch(src, /new\s+Map\s*\(/);
  assert.doesNotMatch(src, /baseUnitRate\s*:/);
  assert.doesNotMatch(src, /hard-?coded|PRODUCTION_RATES/i);
});

test("composition has no persistence, React, Query, route, or presentation ownership", () => {
  const src = stripComments(read(COMPOSITION));
  assert.doesNotMatch(src, /persist_category_engine_estimate|persist_measured|\.rpc\s*\(/);
  assert.doesNotMatch(src, /saveProjectEstimate|saveAIEstimate|estimate\.repository/);
  assert.doesNotMatch(src, /from\s+["']react["']|@tanstack\/react-query|QueryClient/);
  assert.doesNotMatch(
    src,
    /toast|navigate|useNavigate|createFileRoute|from\s+["'][^"']*presentation/,
  );
  assert.doesNotMatch(src, /from\s+["']react-router|@tanstack\/react-router/);
});

test("browser-safe estimate barrels do not export the server composition", () => {
  for (const barrel of [APP_INDEX, ESTIMATE_INDEX, INFRA_INDEX]) {
    const src = read(barrel);
    assert.doesNotMatch(src, /repriceMeasuredBoqWithCatalogue/);
    assert.doesNotMatch(src, /measuredBoq\/repriceMeasuredBoqWithCatalogue/);
    assert.doesNotMatch(src, /from\s+["']\.\/measuredBoq/);
    assert.doesNotMatch(src, /export\s+\{[^}]*measuredBoq/);
  }
  // Catalogue loader still not barrel-exported (comments may name the path)
  const infra = read(INFRA_INDEX);
  assert.doesNotMatch(infra, /export\s+\{[^}]*measuredBoqCatalogue/);
  assert.doesNotMatch(infra, /from\s+["'].*catalogue\//);
});

test("pure reprice wrapper remains pure and composition remains the IO seam", () => {
  const reprice = stripComments(read(REPRICE));
  assert.doesNotMatch(reprice, /loadMeasuredBoqCatalogueSnapshot|createServiceRoleSupabase/);
  assert.match(reprice, /runMeasuredBoqEngine/);
  const loader = read(LOADER);
  assert.match(loader, /loadMeasuredBoqCatalogueSnapshot/);
  assert.match(loader, /\.server\.ts|service\.server|createServiceRoleSupabase/);
});

// ── Negative probes (temporary synthetic sources — never tracked files) ────

test("negative: comment-only mention of canonical names fails structural checks", () => {
  const fake = `
    // assertSingleCatalogRevision
    // loadMeasuredBoqCatalogueSnapshot
    // repriceMeasuredBoq
    export async function repriceMeasuredBoqWithCatalogue() {
      return null;
    }
  `;
  const stripped = stripComments(fake);
  assert.doesNotMatch(stripped, /assertSingleCatalogRevision\s*\(/);
  assert.doesNotMatch(stripped, /loadMeasuredBoqCatalogueSnapshot/);
  assert.doesNotMatch(stripped, /repriceMeasuredBoq\s*\(/);
});

test("negative: load-before-gate ordering is rejected by source-order invariant", () => {
  const fake = stripComments(`
    export async function repriceMeasuredBoqWithCatalogue(command) {
      const snapshot = await loadMeasuredBoqCatalogueSnapshot({
        catalogRevision: "x",
        purpose: command.purpose,
      });
      const gate = assertSingleCatalogRevision(command.input);
      return repriceMeasuredBoq(command.input, {
        resolveLibraryRate: snapshot.resolveLibraryRate,
      });
    }
  `);
  const gateIdx = fake.indexOf("assertSingleCatalogRevision");
  const loadIdx = fake.indexOf("loadMeasuredBoqCatalogueSnapshot");
  assert.ok(loadIdx < gateIdx, "probe setup: load must precede gate");
  // Production must fail this ordering check
  const production = stripComments(read(COMPOSITION));
  const pGate = production.indexOf("assertSingleCatalogRevision");
  const pLoad = production.indexOf("loadMeasuredBoqCatalogueSnapshot");
  assert.ok(pGate < pLoad, "production keeps gate before load");
});

test("negative: hard-coded Map resolver and latest alias would fail production scans", () => {
  const fakeMap = stripComments(`
    const rates = new Map([["paint.m2", { baseUnitRate: 10 }]]);
    resolveLibraryRate: (ref) => rates.get(ref.rateKey)
  `);
  assert.match(fakeMap, /new\s+Map\s*\(/);
  assert.match(fakeMap, /baseUnitRate\s*:/);
  assert.doesNotMatch(stripComments(read(COMPOSITION)), /new\s+Map\s*\(/);
  assert.doesNotMatch(stripComments(read(COMPOSITION)), /baseUnitRate\s*:/);

  const fakeLatest = `catalogRevision: "latest"`;
  assert.match(fakeLatest, /["']latest["']/);
  assert.doesNotMatch(stripComments(read(COMPOSITION)), /["']latest["']/);
});

test("negative: category fallback and persistence symbols fail composition scans", () => {
  const fake = stripComments(`
    import { runPricingEngine } from "@repo/services";
    const CATEGORY_BASE = 1;
    await supabase.rpc("persist_category_engine_estimate", {});
  `);
  assert.match(fake, /runPricingEngine/);
  assert.match(fake, /CATEGORY_BASE/);
  assert.match(fake, /persist_category_engine_estimate/);
  const prod = stripComments(read(COMPOSITION));
  assert.doesNotMatch(prod, /runPricingEngine|CATEGORY_BASE|persist_category/);
});

test("negative: public barrel export and presentation import of composition fail checks", () => {
  const fakeBarrel = `export { repriceMeasuredBoqWithCatalogue } from "./measuredBoq/repriceMeasuredBoqWithCatalogue.server";`;
  assert.match(fakeBarrel, /repriceMeasuredBoqWithCatalogue/);
  for (const barrel of [APP_INDEX, ESTIMATE_INDEX, INFRA_INDEX]) {
    assert.doesNotMatch(read(barrel), /repriceMeasuredBoqWithCatalogue/);
  }

  const fakePresentation = `
    import { loadMeasuredBoqCatalogueSnapshot } from
      "../../infrastructure/catalogue/measuredBoqCatalogue.repository.server";
  `;
  assert.match(fakePresentation, /measuredBoqCatalogue\.repository\.server/);
  // Presentation components must not import the composition or repository
  // (serverFns may dynamic-import later; not authorized in 4C2D-B)
  const presentationDir = join(ROOT, "src/features/estimate/presentation");
  if (existsSync(presentationDir)) {
    function walk(dir: string, files: string[] = []): string[] {
      for (const e of readdirSync(dir)) {
        const full = join(dir, e);
        if (statSync(full).isDirectory()) walk(full, files);
        else if (e.endsWith(".ts") || e.endsWith(".tsx")) files.push(full);
      }
      return files;
    }
    for (const file of walk(presentationDir)) {
      if (file.endsWith("serverFns.ts")) continue;
      const src = stripComments(readFileSync(file, "utf8"));
      assert.doesNotMatch(src, /repriceMeasuredBoqWithCatalogue/);
      assert.doesNotMatch(src, /measuredBoqCatalogue\.repository\.server/);
    }
  }
});

test("negative: temporary file with barrel export would violate production barrel invariant", () => {
  const probeDir = join(tmpdir(), `4c2d-probe-${process.pid}`);
  mkdirSync(probeDir, { recursive: true });
  const probeFile = join(probeDir, "fake-barrel.ts");
  try {
    writeFileSync(
      probeFile,
      `export { repriceMeasuredBoqWithCatalogue } from "./repriceMeasuredBoqWithCatalogue.server";\n`,
    );
    const probeSrc = readFileSync(probeFile, "utf8");
    assert.match(probeSrc, /repriceMeasuredBoqWithCatalogue/);
    // Production barrels still clean
    assert.doesNotMatch(read(APP_INDEX), /repriceMeasuredBoqWithCatalogue/);
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
});

test("positive probe: production composition matches required structural contract", () => {
  const src = stripComments(read(COMPOSITION));
  assert.match(src, /assertSingleCatalogRevision\s*\(/);
  assert.match(src, /loadMeasuredBoqCatalogueSnapshot/);
  assert.match(src, /repriceMeasuredBoq\s*\(/);
  assert.match(src, /resolveLibraryRate:\s*snapshot\.resolveLibraryRate/);
  assert.match(src, /CatalogueLoadError/);
  assert.ok(
    src.indexOf("assertSingleCatalogRevision") < src.indexOf("loadMeasuredBoqCatalogueSnapshot"),
  );
  assert.ok(src.indexOf("loadMeasuredBoqCatalogueSnapshot") < src.indexOf("repriceMeasuredBoq("));
});
