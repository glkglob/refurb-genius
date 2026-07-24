/**
 * Phase 10B C7 — AI Upload public API seal.
 *
 * External modules must not import @/features/ai-upload/infrastructure.
 * Use @/features/ai-upload (public barrel re-exports browser-safe infrastructure).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const SRC = join(ROOT, "src");
/** Static import / re-export: import|export ... from "..." */
const STATIC_IMPORT_PATTERN =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g;
/** Dynamic import: import("...") / import('...') */
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const FORBIDDEN = "@/features/ai-upload/infrastructure";

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

function isInsideAiUploadFeature(rel: string): boolean {
  return rel === "src/features/ai-upload" || rel.startsWith("src/features/ai-upload/");
}

function isForbiddenSpecifier(specifier: string): boolean {
  return (
    specifier === FORBIDDEN ||
    specifier.startsWith(`${FORBIDDEN}/`) ||
    specifier.startsWith(`${FORBIDDEN}?`)
  );
}

function collectViolations(file: string, rel: string): string[] {
  const content = readFileSync(file, "utf8");
  const violations: string[] = [];

  for (const match of content.matchAll(new RegExp(STATIC_IMPORT_PATTERN.source, "g"))) {
    const specifier = match[1] ?? "";
    if (isForbiddenSpecifier(specifier)) {
      violations.push(`${rel} -> ${specifier}`);
    }
  }

  for (const match of content.matchAll(new RegExp(DYNAMIC_IMPORT_PATTERN.source, "g"))) {
    const specifier = match[1] ?? "";
    if (isForbiddenSpecifier(specifier)) {
      violations.push(`${rel} -> dynamic ${specifier}`);
    }
  }

  return violations;
}

test("ai-upload public API seal — no external imports of @/features/ai-upload/infrastructure", () => {
  const violations: string[] = [];

  for (const file of listTsFiles(SRC)) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (isInsideAiUploadFeature(rel)) continue;
    violations.push(...collectViolations(file, rel));
  }

  assert.deepEqual(
    violations,
    [],
    `External ai-upload infrastructure imports (use @/features/ai-upload):\n${violations.join("\n")}`,
  );
});

test("ai-upload public API re-exports infrastructure surface", () => {
  const indexPath = join(ROOT, "src/features/ai-upload/index.ts");
  assert.ok(existsSync(indexPath));
  const text = readFileSync(indexPath, "utf8");
  assert.match(text, /from ["']\.\/infrastructure["']/);
  assert.match(text, /analysisStore|export \* from ["']\.\/infrastructure["']/);
});
