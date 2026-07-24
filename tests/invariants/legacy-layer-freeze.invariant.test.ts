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
import {
  HOOKS_ALLOWLIST_SET,
  LIB_ALLOWLIST_SET,
  SERVICES_ALLOWLIST_SET,
} from "./config/frozen-path-allowlists.ts";

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
      `(If this is genuinely cross-cutting, update tests/invariants/config/frozen-path-allowlists.ts ` +
      `and FEATURE_SLICE.md.)`,
  );

  // Allowlist entries may be deleted during migration (good). Only fail on *new* files.
  // Report missing for visibility without failing — migration shrinks the layer.
  if (missing.length > 0) {
    // soft: deleted allowlisted files are OK (layer shrinking)
  }
}

test("legacy freeze — src/lib only contains allowlisted transitional files", () => {
  assertFrozen("src/lib", LIB_ALLOWLIST_SET, "src/lib");
});

test("legacy freeze — src/hooks only contains allowlisted app-shell hooks", () => {
  assertFrozen("src/hooks", HOOKS_ALLOWLIST_SET, "src/hooks");
});

test("legacy freeze — src/services only contains allowlisted integration seams", () => {
  assertFrozen("src/services", SERVICES_ALLOWLIST_SET, "src/services");
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

test("feature ownership guide documents recommended layout without requiring empty layers", () => {
  const guide = join(ROOT, "src/features/README.md");
  assert.ok(existsSync(guide), "src/features/README.md must exist");
  const text = readFileSync(guide, "utf8");
  assert.match(text, /domain\//);
  assert.match(text, /application\//);
  assert.match(text, /infrastructure\//);
  assert.match(text, /presentation\//);
  assert.match(text, /index\.ts/);
  assert.match(text, /ceremonial|empty/i);
  assert.match(text, /Minimum viable/i);

  const arch = readFileSync(join(ROOT, "docs/architecture/FEATURE_SLICE.md"), "utf8");
  assert.match(arch, /Recommended layout inside/);
  assert.match(arch, /Avoid empty ceremonial|avoid empty ceremonial/i);
});

test("platform architecture plan documents multi-app ownership and no cross-app imports", () => {
  const plan = join(ROOT, "docs/architecture/platform-architecture-plan.md");
  assert.ok(existsSync(plan), "platform-architecture-plan.md must exist");
  const text = readFileSync(plan, "utf8");
  assert.match(text, /Applications own product workflows/i);
  assert.match(text, /Shared packages own reusable capabilities/i);
  assert.match(text, /Applications never import one another/i);
  assert.match(text, /apps\/refurb-genius/);
  assert.match(text, /packages\//);
  assert.match(text, /Application features/);
  // Must not mandate empty package shells
  assert.match(text, /lazily|Empty packages are Forbidden|empty shells/i);
});

test("platform plan defines shared domain services vs platform capabilities", () => {
  const plan = readFileSync(join(ROOT, "docs/architecture/platform-architecture-plan.md"), "utf8");
  assert.match(plan, /Shared domain services/i);
  assert.match(plan, /deterministic/i);
  assert.match(plan, /React-free|React-free/i);
  assert.match(plan, /packages\/services/);
  assert.match(plan, /pricing/);
  assert.match(plan, /roi/i);
  assert.match(plan, /Shared platform capabilities/i);
  assert.match(plan, /packages\/auth|auth/);
  assert.match(plan, /packages\/storage|storage/);
  assert.match(plan, /never know which application/i);

  const servicesReadme = readFileSync(join(ROOT, "packages/services/README.md"), "utf8");
  assert.match(servicesReadme, /orchestrate/i);
  assert.match(servicesReadme, /React/);
});
