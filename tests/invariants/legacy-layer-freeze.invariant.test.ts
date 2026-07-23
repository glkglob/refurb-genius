/**
 * Freezes legacy horizontal layers so new domain logic lands in feature slices.
 *
 * Policy (docs/architecture/FEATURE_SLICE.md):
 * - Route → presentation → application → domain → infrastructure → platform/@repo
 * - Do not add new domain modules under src/lib, src/hooks, or src/services
 *   unless they are genuinely cross-cutting utilities already on the allowlist.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectSourceFiles(full, files);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(relative(ROOT, full).replace(/\\/g, "/"));
    }
  }
  return files;
}

/**
 * Known transitional files under src/lib. Adding a NEW .ts/.tsx path under
 * src/lib that is not listed here fails CI — put domain work in a feature slice.
 */
const LIB_ALLOWLIST = new Set([
  "src/lib/ai-quality-audit.ts",
  "src/lib/ai-quality-feedback.ts",
  "src/lib/analytics.ts",
  "src/lib/auth.ts",
  "src/lib/concurrency.ts",
  "src/lib/deal-copilot/dealAnalysis.ts",
  "src/lib/deal-copilot/dealFormatting.ts",
  "src/lib/deal-copilot/dealValidation.ts",
  "src/lib/deal-copilot/diagnostics.ts",
  "src/lib/deal-copilot/safety.ts",
  "src/lib/email.ts",
  "src/lib/env-validation.ts",
  "src/lib/error-capture.ts",
  "src/lib/error-page.ts",
  "src/lib/estimate.ts",
  "src/lib/exportPdf.ts",
  "src/lib/file-utils.ts",
  "src/lib/floorplan.ts",
  "src/lib/gallery.ts",
  "src/lib/logger.ts",
  "src/lib/mappers.ts",
  "src/lib/mockData.ts",
  "src/lib/observability.ts",
  "src/lib/photos.ts",
  "src/lib/pitchDeck.test.ts",
  "src/lib/pitchDeck.ts",
  "src/lib/projects.ts",
  "src/lib/provider-diagnostics.ts",
  "src/lib/provider-health-analysis.ts",
  "src/lib/provider-validation-fixtures.ts",
  "src/lib/queries/floorplans.test.ts",
  "src/lib/queries/floorplans.ts",
  "src/lib/queries/gallery.test.ts",
  "src/lib/queries/gallery.ts",
  "src/lib/queries/marketplace.test.ts",
  "src/lib/queries/marketplace.ts",
  "src/lib/queries/photo-analysis.test.ts",
  "src/lib/queries/photo-analysis.ts",
  "src/lib/queries/pitch-decks.test.ts",
  "src/lib/queries/pitch-decks.ts",
  "src/lib/queries/projects.ts",
  "src/lib/rate-limit.ts",
  "src/lib/redesign.ts",
  "src/lib/role.ts",
  "src/lib/sentry.ts",
  "src/lib/telemetry.ts",
  "src/lib/timeout.ts",
  "src/lib/utils.ts",
]);

const HOOKS_ALLOWLIST = new Set([
  "src/hooks/use-mobile.tsx",
  "src/hooks/useAuth.ts",
  "src/hooks/useGallery.ts",
  "src/hooks/useOpportunities.ts",
  "src/hooks/useProjects.ts",
  "src/hooks/useRole.ts",
  "src/hooks/useTheme.ts",
]);

const SERVICES_ALLOWLIST = new Set([
  "src/services/projects/index.ts",
  "src/services/storage/index.ts",
  "src/services/trades/tradeProfileStore.ts",
  "src/services/trades/tradesJobInterestStore.ts",
  "src/services/trades/tradesJobStore.ts",
]);

function assertFrozen(dir: string, allowlist: Set<string>, label: string) {
  const actual = collectSourceFiles(join(ROOT, dir)).sort();
  const unexpected = actual.filter((f) => !allowlist.has(f));
  const missing = [...allowlist].filter((f) => !actual.includes(f)).sort();

  assert.deepEqual(
    unexpected,
    [],
    `${label}: new source files are not allowed under ${dir}/.\n` +
      `Add domain logic under src/features/<slice>/ instead.\n` +
      `Unexpected:\n${unexpected.join("\n")}\n` +
      `(If this is genuinely cross-cutting, update the allowlist in ` +
      `tests/invariants/legacy-layer-freeze.invariant.test.ts and FEATURE_SLICE.md.)`,
  );

  // Allowlist entries may be deleted during migration (good). Only fail on *new* files.
  // Report missing for visibility without failing — migration shrinks the layer.
  if (missing.length > 0) {
    // soft: deleted allowlisted files are OK (layer shrinking)
  }
}

test("legacy freeze — src/lib only contains allowlisted transitional files", () => {
  assertFrozen("src/lib", LIB_ALLOWLIST, "src/lib");
});

test("legacy freeze — src/hooks only contains allowlisted app-shell hooks", () => {
  assertFrozen("src/hooks", HOOKS_ALLOWLIST, "src/hooks");
});

test("legacy freeze — src/services only contains allowlisted integration seams", () => {
  assertFrozen("src/services", SERVICES_ALLOWLIST, "src/services");
});

test("feature slices — required standardized capabilities exist with public API", () => {
  const required = [
    "estimate",
    "ai-upload",
    "ai-design",
    "export",
    "roi",
    "feasibility",
    "sharing",
    "payment",
    "gallery",
  ];

  for (const name of required) {
    const index = join(ROOT, "src/features", name, "index.ts");
    assert.ok(existsSync(index), `Missing slice public API: features/${name}/index.ts`);
    for (const layer of ["domain", "application", "infrastructure", "presentation"] as const) {
      const layerDir = join(ROOT, "src/features", name, layer);
      assert.ok(existsSync(layerDir), `Missing layer features/${name}/${layer}/`);
    }
  }
});

test("canonical request flow is documented", () => {
  const doc = join(ROOT, "docs/architecture/FEATURE_SLICE.md");
  assert.ok(existsSync(doc));
  const text = readFileSync(doc, "utf8");
  assert.match(text, /Route/);
  assert.match(text, /feature presentation/i);
  assert.match(text, /application/);
  assert.match(text, /infrastructure adapter/i);
  assert.match(text, /platform/i);
});
