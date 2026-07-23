/**
 * Priority 1.11 — Cross-application / package dependency enforcement.
 *
 * Forbidden:
 * - package → app (features, lib, hooks, routes, serverFns, core app paths via @/)
 * - domain services / core / types importing React or Supabase/OpenAI SDKs
 * - (future) app → app when apps/ exists
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?(?:[^'"\n]*?\sfrom\s+)?["']([^"']+)["']/g;

function listTsFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) listTsFiles(full, files);
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts")) files.push(full);
  }
  return files;
}

function importsOf(file: string): string[] {
  const src = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const out: string[] = [];
  for (const m of src.matchAll(IMPORT_RE)) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

const APP_PATH_PREFIXES = [
  "@/features/",
  "@/lib/",
  "@/hooks/",
  "@/routes/",
  "@/serverFns/",
  "@/components/",
  "@/core/",
  "@/integrations/",
  "@/platform/",
  "apps/",
];

function isAppImport(spec: string): boolean {
  return APP_PATH_PREFIXES.some((p) => spec === p.slice(0, -1) || spec.startsWith(p));
}

const KERNEL_PACKAGES = ["packages/types", "packages/core", "packages/services"];

test("packages must not import application paths (features, lib, hooks, routes, …)", () => {
  const violations: string[] = [];
  const pkgRoot = join(ROOT, "packages");
  for (const file of listTsFiles(pkgRoot)) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    // Skip pure comments-only path references already stripped
    for (const spec of importsOf(file)) {
      if (isAppImport(spec)) {
        violations.push(`${rel} → ${spec}`);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `Package → application imports are forbidden.\n` +
      `Move shared types to @repo/types and pure data to @repo/core.\n` +
      violations.join("\n"),
  );
});

test("domain kernel packages (types, core, services) stay React- and vendor-SDK-free", () => {
  const forbidden = [
    /^react$/,
    /^react\//,
    /^react-dom/,
    /^@tanstack\//,
    /^@supabase\//,
    /^openai$/,
    /^posthog/,
  ];
  const violations: string[] = [];
  for (const pkg of KERNEL_PACKAGES) {
    for (const file of listTsFiles(join(ROOT, pkg))) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      for (const spec of importsOf(file)) {
        if (forbidden.some((re) => re.test(spec))) {
          violations.push(`${rel} → ${spec}`);
        }
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `Kernel packages must not depend on React or vendor SDKs:\n${violations.join("\n")}`,
  );
});

test("when apps/ exists, applications must not import other applications", () => {
  const appsRoot = join(ROOT, "apps");
  if (!existsSync(appsRoot)) {
    assert.ok(true, "single-app layout — rule reserved for multi-app");
    return;
  }
  const violations: string[] = [];
  const appNames = readdirSync(appsRoot).filter((n) => statSync(join(appsRoot, n)).isDirectory());
  for (const app of appNames) {
    const appDir = join(appsRoot, app);
    for (const file of listTsFiles(appDir)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      for (const spec of importsOf(file)) {
        for (const other of appNames) {
          if (other === app) continue;
          if (
            spec.includes(`apps/${other}`) ||
            spec.startsWith(`@${other}/`) ||
            spec.includes(`/apps/${other}/`)
          ) {
            violations.push(`${rel} → ${spec}`);
          }
        }
      }
    }
  }
  assert.deepEqual(violations, [], `App → app imports:\n${violations.join("\n")}`);
});

test("platform docs cover promotion, capabilities, glossary, package registry", () => {
  const required = [
    "docs/architecture/package-registry.md",
    "docs/architecture/package-promotion.md",
    "docs/architecture/capability-boundaries.md",
    "docs/architecture/platform-glossary.md",
    "docs/architecture/platform-architecture-plan.md",
  ];
  for (const f of required) {
    assert.ok(existsSync(join(ROOT, f)), `missing ${f}`);
  }
  const plan = readFileSync(join(ROOT, "docs/architecture/platform-architecture-plan.md"), "utf8");
  assert.match(plan, /packages\/ui/);
  assert.match(plan, /platform-ui/);
  assert.match(plan, /Package promotion/i);
});
