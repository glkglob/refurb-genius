/**
 * Phase 12C C4a — Projects domain purity.
 * Phase 13C C4b — projectStore ownership under core; lib is compat-only.
 *
 * Files under src/core/projects/domain must remain pure (no React, Supabase,
 * hooks, routes, presentation, serverFns, or lib/projects).
 * Runtime store body lives in src/core/projects/projectStore.ts only.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const DOMAIN_DIR = join(ROOT, "src/core/projects/domain");
const CORE_PROJECTS_DIR = join(ROOT, "src/core/projects");
const STORE_PATH = join(ROOT, "src/core/projects/projectStore.ts");
const LIB_PROJECTS_PATH = join(ROOT, "src/lib/projects.ts");
const IMPORT_PATTERN = /\b(?:import|export)\s+(?:type\s+)?(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g;

const FORBIDDEN_PREFIXES = [
  "react",
  "react-dom",
  "react/",
  "react-dom/",
  "@tanstack/react-query",
  "@tanstack/react-router",
  "@/platform/",
  "@/serverFns/",
  "@/routes/",
  "@/components/",
  "@/hooks/",
  "@/features/",
  "@/lib/projects",
  "@/lib/photos",
  "@/lib/queries",
  "@/lib/auth",
  "@supabase/",
] as const;

function listTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

function isForbiddenSpecifier(specifier: string): boolean {
  if (specifier === "react" || specifier === "react-dom") return true;
  for (const prefix of FORBIDDEN_PREFIXES) {
    if (specifier === prefix || specifier.startsWith(prefix)) return true;
  }
  if (specifier.includes("supabase") && !specifier.includes("@repo/supabase")) {
    if (specifier.startsWith("@supabase/") || specifier === "supabase") return true;
  }
  return false;
}

function collectSrcTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSrcTsFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

test("projects domain purity — domain modules import only pure dependencies", () => {
  assert.ok(existsSync(DOMAIN_DIR), "missing src/core/projects/domain");
  const violations: string[] = [];

  for (const file of listTsFiles(DOMAIN_DIR)) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(new RegExp(IMPORT_PATTERN.source, "g"))) {
      const specifier = match[1] ?? "";
      if (isForbiddenSpecifier(specifier)) {
        violations.push(`${rel} -> ${specifier}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Projects domain must stay pure (no React/Supabase/hooks/routes/lib store):\n${violations.join("\n")}`,
  );
});

test("projects domain purity — public barrel exports domain surface", () => {
  const indexPath = join(DOMAIN_DIR, "index.ts");
  assert.ok(existsSync(indexPath));
  const text = readFileSync(indexPath, "utf8");
  assert.match(text, /estimatedRefurbCost/);
  assert.match(text, /estimatedProfit/);
  assert.match(text, /UK_REGIONS|PROPERTY_TYPES/);
  assert.match(text, /Project/);
});

test("projects domain purity — lib/projects does not redefine Project type body", () => {
  assert.ok(existsSync(LIB_PROJECTS_PATH));
  const text = readFileSync(LIB_PROJECTS_PATH, "utf8");
  assert.doesNotMatch(
    text,
    /export type Project\s*=\s*\{/,
    "lib/projects must re-export Project from domain, not redefine it",
  );
  assert.match(text, /@\/core\/projects\/domain/);
});

test("projects store ownership — implementation lives in core projectStore", () => {
  assert.ok(existsSync(STORE_PATH), "missing src/core/projects/projectStore.ts");
  const storeText = readFileSync(STORE_PATH, "utf8");
  assert.match(
    storeText,
    /export const projectStore\s*=/,
    "canonical projectStore must be defined in src/core/projects/projectStore.ts",
  );
});

test("projects store ownership — lib/projects is re-export only", () => {
  assert.ok(existsSync(LIB_PROJECTS_PATH));
  const text = readFileSync(LIB_PROJECTS_PATH, "utf8");

  assert.doesNotMatch(
    text,
    /export const projectStore\s*=/,
    "lib/projects must not define projectStore implementation",
  );
  assert.match(
    text,
    /export\s*\{[^}]*\bprojectStore\b[^}]*\}\s*from\s*["']@\/core\/projects\/projectStore["']/,
    "lib/projects must re-export projectStore from @/core/projects/projectStore",
  );

  const runtimeMarkers = [
    /\blet\s+cache\b/,
    /\bfunction\s+fetchAll\b/,
    /\bauth\.onChange\b/,
    /\blisteners\s*=\s*new\s+Set\b/,
    /\bsupabase\.from\b/,
  ];
  for (const marker of runtimeMarkers) {
    assert.doesNotMatch(
      text,
      marker,
      `lib/projects must not contain runtime store marker ${marker}`,
    );
  }
});

test("projects store ownership — exactly one projectStore definition under src", () => {
  const srcRoot = join(ROOT, "src");
  const defs: string[] = [];
  for (const file of collectSrcTsFiles(srcRoot)) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    const text = readFileSync(file, "utf8");
    if (/export const projectStore\s*=/.test(text)) {
      defs.push(rel);
    }
  }
  assert.deepEqual(
    defs,
    ["src/core/projects/projectStore.ts"],
    `expected exactly one projectStore definition, found:\n${defs.join("\n")}`,
  );
});

test("projects store ownership — core/projects does not import lib/projects", () => {
  const violations: string[] = [];
  for (const file of listTsFiles(CORE_PROJECTS_DIR)) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(new RegExp(IMPORT_PATTERN.source, "g"))) {
      const specifier = match[1] ?? "";
      if (specifier === "@/lib/projects" || specifier.startsWith("@/lib/projects/")) {
        violations.push(`${rel} -> ${specifier}`);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `core/projects must not import @/lib/projects:\n${violations.join("\n")}`,
  );
});
