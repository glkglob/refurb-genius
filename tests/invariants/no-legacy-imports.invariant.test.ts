import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { LEGACY_IMPORT_BASELINE_SET } from "./config/legacy-import-baseline.ts";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const IMPORT_PATTERN = /\b(?:import|export)\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g;
const TARGET_DIRS = ["src/routes", "src/hooks", "src/components", "src/serverFns"] as const;
const FORBIDDEN_PREFIXES = ["@/core/", "@/lib/", "@/services/", "@/integrations/"] as const;
const MIGRATION_GUIDANCE = "@/features/... or @/platform/...";

/** Exact baseline edges — registry source of truth (Phase 3). */
const BASELINE_ALLOWLIST = LEGACY_IMPORT_BASELINE_SET;
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

function collectCurrentViolations(): string[] {
  const found = new Set<string>();

  for (const targetDir of TARGET_DIRS) {
    const absDir = join(ROOT, targetDir);
    for (const file of listTsFiles(absDir)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      const content = readFileSync(file, "utf8");
      for (const match of content.matchAll(
        new RegExp(IMPORT_PATTERN.source, IMPORT_PATTERN.flags),
      )) {
        const specifier = match[1] ?? "";
        if (!FORBIDDEN_PREFIXES.some((prefix) => specifier.startsWith(prefix))) continue;
        found.add(`${rel}|${specifier}`);
      }
    }
  }

  return Array.from(found).sort();
}

function formatViolation(entry: string): string {
  const [file, specifier] = entry.split("|");
  return `"${file}" imports forbidden "${specifier}" — migrate to ${MIGRATION_GUIDANCE}.`;
}

test("no legacy imports in routes/hooks/components/serverFns beyond approved baseline", () => {
  const observed = collectCurrentViolations();
  const newViolations = observed.filter((entry) => !BASELINE_ALLOWLIST.has(entry));
  const resolvedFromBaseline = Array.from(BASELINE_ALLOWLIST).filter(
    (entry) => !observed.includes(entry),
  );

  const message = [
    "New legacy-import violations detected:",
    ...newViolations.map(formatViolation),
    resolvedFromBaseline.length > 0
      ? "\nResolved baseline entries (remove from tests/invariants/config/legacy-import-baseline.ts):"
      : "",
    ...resolvedFromBaseline.map((entry) => `- ${entry}`),
  ]
    .filter(Boolean)
    .join("\n");

  // Ratchet: new edges fail. Resolved edges are reported so baselines cannot silently remain.
  assert.deepEqual(newViolations, [], message);
  if (resolvedFromBaseline.length > 0) {
    assert.fail(
      `Stale legacy-import baseline entries (imports no longer present). Remove them from ` +
        `tests/invariants/config/legacy-import-baseline.ts:\n` +
        resolvedFromBaseline.map((e) => `- ${e}`).join("\n"),
    );
  }
});
