/**
 * Phase 9 C2 — Estimate public API seal.
 *
 * External modules must not import @/features/estimate/infrastructure.
 * Use @/features/estimate (public barrel re-exports browser-safe infrastructure).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const SRC = join(ROOT, "src");
const IMPORT_PATTERN = /\b(?:import|export)\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g;
const FORBIDDEN = "@/features/estimate/infrastructure";

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

function isInsideEstimateFeature(rel: string): boolean {
  return rel === "src/features/estimate" || rel.startsWith("src/features/estimate/");
}

test("estimate public API seal — no external imports of @/features/estimate/infrastructure", () => {
  const violations: string[] = [];

  for (const file of listTsFiles(SRC)) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (isInsideEstimateFeature(rel)) continue;

    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(new RegExp(IMPORT_PATTERN.source, IMPORT_PATTERN.flags))) {
      const specifier = match[1] ?? "";
      if (
        specifier === FORBIDDEN ||
        specifier.startsWith(`${FORBIDDEN}/`) ||
        specifier.startsWith(`${FORBIDDEN}?`)
      ) {
        violations.push(`${rel} -> ${specifier}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `External estimate infrastructure imports (use @/features/estimate):\n${violations.join("\n")}`,
  );
});

test("estimate public API re-exports infrastructure surface", () => {
  const indexPath = join(ROOT, "src/features/estimate/index.ts");
  assert.ok(existsSync(indexPath));
  const text = readFileSync(indexPath, "utf8");
  assert.match(text, /from ["']\.\/infrastructure["']/);
  assert.match(text, /saveProjectEstimate|export \* from ["']\.\/infrastructure["']/);
});
