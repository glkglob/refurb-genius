import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const SRC = join(ROOT, "src");
const IMPORT_PATTERN = /\b(?:import|export)\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g;

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

function getSliceFromSource(absPath: string): string | null {
  const rel = relative(ROOT, absPath).replace(/\\/g, "/");
  const match = rel.match(/^src\/features\/([^/]+)\//);
  return match?.[1] ?? null;
}

function normalizeFeaturePath(specifier: string): string | null {
  if (!specifier.startsWith("@/features/")) return null;
  const rest = specifier.slice("@/features/".length);
  const firstSlash = rest.indexOf("/");
  if (firstSlash === -1) return `${rest}/index`;
  const slice = rest.slice(0, firstSlash);
  const subpath = rest.slice(firstSlash + 1);
  if (!subpath || subpath === "index" || subpath === "index.ts") return `${slice}/index`;
  if (
    subpath === "infrastructure" ||
    subpath === "infrastructure/index" ||
    subpath === "infrastructure/index.ts"
  ) {
    return `${slice}/infrastructure/index`;
  }
  return `${slice}/${subpath}`;
}

function isForbiddenCrossSlicePath(normalizedFeaturePath: string): boolean {
  const slash = normalizedFeaturePath.indexOf("/");
  if (slash === -1) return false;
  const rest = normalizedFeaturePath.slice(slash + 1);
  return (
    rest.startsWith("domain/") ||
    rest.startsWith("application/") ||
    rest.startsWith("presentation/") ||
    rest.startsWith("infrastructure/repositories/") ||
    rest.startsWith("infrastructure/adapters/")
  );
}

test("public API boundary — cross-slice imports go through index or infrastructure index", () => {
  const violations: string[] = [];

  for (const file of listTsFiles(SRC)) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    const sourceSlice = getSliceFromSource(file);
    const content = readFileSync(file, "utf8");

    for (const match of content.matchAll(new RegExp(IMPORT_PATTERN.source, IMPORT_PATTERN.flags))) {
      const specifier = match[1] ?? "";
      const normalized = normalizeFeaturePath(specifier);
      if (!normalized) continue;

      const targetSlice = normalized.split("/")[0];
      if (sourceSlice && sourceSlice === targetSlice) continue;

      const isAllowed =
        normalized.endsWith("/index") || normalized.endsWith("/infrastructure/index");
      if (!isAllowed && isForbiddenCrossSlicePath(normalized)) {
        violations.push(`${rel} -> ${specifier}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Cross-slice deep imports detected (source -> import path):\n${violations.join("\n")}`,
  );
});

test("public API boundary — required slice public barrels exist", () => {
  const required = [
    "src/features/estimate/index.ts",
    "src/features/estimate/infrastructure/index.ts",
    "src/features/ai-upload/index.ts",
    "src/features/ai-upload/infrastructure/index.ts",
    "src/features/ai-design/index.ts",
    "src/features/ai-design/infrastructure/index.ts",
    "src/features/export/index.ts",
    "src/features/export/infrastructure/index.ts",
    "src/features/roi/index.ts",
    "src/features/roi/infrastructure/index.ts",
    "src/features/feasibility/index.ts",
    "src/features/feasibility/infrastructure/index.ts",
    "src/features/sharing/index.ts",
    "src/features/sharing/infrastructure/index.ts",
    "src/features/payment/index.ts",
    "src/features/payment/infrastructure/index.ts",
    "src/features/gallery/index.ts",
    "src/features/gallery/infrastructure/index.ts",
    "src/features/auth/index.ts",
  ] as const;

  const missing = required
    .filter((file) => !existsSync(join(ROOT, file)))
    .map((file) => `${file} (missing)`);

  assert.deepEqual(missing, [], `Missing required public API barrels:\n${missing.join("\n")}`);
});
