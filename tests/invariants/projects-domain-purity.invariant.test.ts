/**
 * C4a — Projects domain purity.
 * C4c-5 — projectStore retirement (no Projects singleton store under src).
 *
 * Files under src/core/projects/domain must remain pure (no React, Supabase,
 * hooks, routes, presentation, serverFns, or lib/projects).
 * No projectStore implementation or production import may exist under src.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const DOMAIN_DIR = join(ROOT, "src/core/projects/domain");
const CORE_PROJECTS_DIR = join(ROOT, "src/core/projects");
const STORE_PATH = join(ROOT, "src/core/projects/projectStore.ts");
const HELPERS_PATH = join(ROOT, "src/core/projects/projectHelpers.ts");
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

/** Specifiers that reintroduce the retired Projects store surface. */
const FORBIDDEN_STORE_SPECIFIERS = [
  "@/core/projects/projectStore",
  "@/core/projects/projectHelpers",
  "./projectStore",
  "../projectStore",
  "./projectHelpers",
  "../projectHelpers",
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

test("projects store retirement — projectStore file and definition are absent", () => {
  assert.equal(
    existsSync(STORE_PATH),
    false,
    "src/core/projects/projectStore.ts must not exist (C4c-5 retirement)",
  );
  assert.equal(
    existsSync(HELPERS_PATH),
    false,
    "src/core/projects/projectHelpers.ts must not exist (store-backed helpers retired)",
  );

  const defs: string[] = [];
  for (const file of collectSrcTsFiles(join(ROOT, "src"))) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    const text = readFileSync(file, "utf8");
    if (/export\s+const\s+projectStore\s*=/.test(text)) {
      defs.push(rel);
    }
  }
  assert.deepEqual(
    defs,
    [],
    `no projectStore definition allowed under src, found:\n${defs.join("\n")}`,
  );
});

test("projects store retirement — no production import of projectStore or store helpers", () => {
  const violations: string[] = [];
  for (const file of collectSrcTsFiles(join(ROOT, "src"))) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    const content = readFileSync(file, "utf8");

    for (const match of content.matchAll(new RegExp(IMPORT_PATTERN.source, "g"))) {
      const specifier = match[1] ?? "";
      if (
        FORBIDDEN_STORE_SPECIFIERS.some((s) => specifier === s || specifier.startsWith(`${s}/`))
      ) {
        violations.push(`${rel} imports ${specifier}`);
      }
      if (specifier.endsWith("/projectStore") || specifier.endsWith("/projectHelpers")) {
        violations.push(`${rel} imports ${specifier}`);
      }
    }

    // Named import of the symbol (not comments-only prose in string-heavy files)
    if (/\bimport\s*\{[^}]*\bprojectStore\b[^}]*\}\s*from\s*["']/.test(content)) {
      violations.push(`${rel} named-imports projectStore`);
    }
    if (/\bexport\s*\{[^}]*\bprojectStore\b[^}]*\}/.test(content)) {
      violations.push(`${rel} re-exports projectStore`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `production source must not import or re-export projectStore:\n${violations.join("\n")}`,
  );
});

/** Drop // line comments so retirement docs do not trip symbol bans. */
function codeWithoutLineComments(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      if (idx === -1) return line;
      const before = line.slice(0, idx);
      if (before.endsWith(":")) return line;
      return before;
    })
    .join("\n");
}

test("projects store retirement — lib/projects is domain-only (no mutable store surface)", () => {
  assert.ok(existsSync(LIB_PROJECTS_PATH));
  const text = readFileSync(LIB_PROJECTS_PATH, "utf8");
  const code = codeWithoutLineComments(text);

  assert.doesNotMatch(code, /\bprojectStore\b/, "lib/projects must not export/use projectStore");
  assert.doesNotMatch(
    code,
    /ProjectStoreSnapshot/,
    "lib/projects must not export ProjectStoreSnapshot",
  );
  assert.doesNotMatch(
    code,
    /export const projectStore\s*=/,
    "lib/projects must not define projectStore",
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
      code,
      marker,
      `lib/projects must not contain runtime store marker ${marker}`,
    );
  }
});

test("projects store retirement — core/projects does not import lib/projects", () => {
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

test("projects store retirement — core barrel does not export store surface", () => {
  const indexPath = join(CORE_PROJECTS_DIR, "index.ts");
  assert.ok(existsSync(indexPath));
  const code = codeWithoutLineComments(readFileSync(indexPath, "utf8"));
  assert.doesNotMatch(code, /\bprojectStore\b/, "core/projects index must not export projectStore");
  assert.doesNotMatch(code, /projectHelpers/, "core/projects index must not export projectHelpers");
  assert.doesNotMatch(
    code,
    /\bcreateProject\b|\bgetProjectById\b|\bcalculateProjectProgress\b/,
    "core/projects index must not export store-backed helpers",
  );
});
