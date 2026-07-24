/**
 * Phase 12C C4a — Projects domain purity.
 *
 * Files under src/core/projects/domain must remain pure (no React, Supabase,
 * hooks, routes, presentation, serverFns, or lib/projects).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const DOMAIN_DIR = join(ROOT, "src/core/projects/domain");
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
    // block direct supabase client packages if any
    if (specifier.startsWith("@supabase/") || specifier === "supabase") return true;
  }
  return false;
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
  const libPath = join(ROOT, "src/lib/projects.ts");
  assert.ok(existsSync(libPath));
  const text = readFileSync(libPath, "utf8");
  assert.doesNotMatch(
    text,
    /export type Project\s*=\s*\{/,
    "lib/projects must re-export Project from domain, not redefine it",
  );
  assert.match(text, /@\/core\/projects\/domain/);
  assert.match(text, /export const projectStore/);
});
