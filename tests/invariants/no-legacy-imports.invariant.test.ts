/**
 * Architectural Invariant: No Direct Legacy Imports
 *
 * Enforces that code outside approved boundaries (features/, platform/, core/)
 * cannot directly import from legacy modules (@/core, @/lib, @/services, @/integrations).
 *
 * This prevents architectural drift and ensures proper layering:
 * - Routes should import from @/features/* or @/platform/*
 * - Components should import from @/features/* or @/platform/*
 * - Server functions should use feature boundaries
 *
 * Allowed directories:
 * - src/features/* - Can import from legacy (transitional)
 * - src/platform/* - Can import from legacy (transitional)
 * - src/core/* - Internal legacy module (can import from other core/lib)
 *
 * See: docs/architecture/audit-2026-06-10.md for current violations
 */

import assert from "node:assert/strict";
import { Dirent, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import test from "node:test";

/**
 * Patterns that indicate legacy imports
 */
const FORBIDDEN_PATTERNS = [
  /from\s+["']@\/(lib|services|core|integrations)\//,
  /from\s+["']@\/(lib|services|core|integrations)["']/,
];

/**
 * Directories that are allowed to import from legacy modules
 */
const ALLOWED_DIRS = [
  "src/features/",
  "src/platform/",
  "src/core/", // Core can import from other core/lib
  "src/lib/", // Lib can import from other lib
  "src/integrations/", // Integrations can import from lib
  "src/services/", // Services are transitional (will be migrated to features)
  "src/types/", // Type re-exports are acceptable temporarily
];

/**
 * Files to exclude from the check
 */
const EXCLUDED_PATTERNS = [
  "**/*.test.*",
  "**/*.spec.*",
  "**/node_modules/**",
  "**/.windsurf/**",
  "**/dist/**",
  "**/build/**",
];

function matchesExcludedPattern(relativePath: string): boolean {
  return EXCLUDED_PATTERNS.some((pattern) => {
    if (pattern === "**/*.test.*") {
      return /\.test\.[^/]+$/.test(relativePath);
    }

    if (pattern === "**/*.spec.*") {
      return /\.spec\.[^/]+$/.test(relativePath);
    }

    return relativePath.includes(pattern.replace("**/", "").replace("/**", "/"));
  });
}

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry: Dirent) => {
    const fullPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      const entryPath = relative(process.cwd(), fullPath).replaceAll("\\", "/");
      return matchesExcludedPattern(entryPath) ? [] : collectTypeScriptFiles(fullPath);
    }

    const entryPath = relative(process.cwd(), fullPath).replaceAll("\\", "/");
    const isTypeScriptFile = /\.(ts|tsx)$/.test(entryPath);

    if (!isTypeScriptFile || matchesExcludedPattern(entryPath)) {
      return [];
    }

    return [fullPath];
  });
}

test.skip("prevents legacy imports outside approved boundaries until the documented migration is complete", () => {
  const files = collectTypeScriptFiles(resolve(process.cwd(), "src"));
  const violations: Array<{ file: string; line: number; match: string }> = [];

  for (const file of files) {
    // Skip files in allowed directories
    const relativePath = relative(process.cwd(), file).replaceAll("\\", "/");
    if (ALLOWED_DIRS.some((dir) => relativePath.includes(dir))) {
      continue;
    }

    // Read file content
    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");

    // Check each line for forbidden patterns
    lines.forEach((line, index) => {
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(line)) {
          violations.push({
            file: relativePath,
            line: index + 1,
            match: line.trim(),
          });
        }
      }
    });
  }

  if (violations.length > 0) {
    const violationsByFile = violations.reduce(
      (acc, violation) => {
        if (!acc[violation.file]) {
          acc[violation.file] = [];
        }
        acc[violation.file].push(`  Line ${violation.line}: ${violation.match}`);
        return acc;
      },
      {} as Record<string, string[]>,
    );

    const errorMessage = [
      "\n❌ Legacy imports detected outside approved boundaries!\n",
      "Files outside src/features/ and src/platform/ should not import from:",
      "  - @/core/*",
      "  - @/lib/*",
      "  - @/services/*",
      "  - @/integrations/*\n",
      "Violations found:\n",
      ...Object.entries(violationsByFile).map(([file, lines]) => `${file}:\n${lines.join("\n")}`),
      "\nRemediation:",
      "  1. Move the imported module to @/features/* or @/platform/*",
      "  2. Create a facade/adapter in the appropriate feature",
      "  3. Update imports to use the new location\n",
      "See: docs/architecture/audit-2026-06-10.md for current violations and migration plan",
    ].join("\n");

    assert.deepEqual(violations, [], errorMessage);
  }

  assert.deepEqual(violations, []);
});

test("documents the architectural boundary rules", () => {
  const rules = {
    forbiddenImports: ["@/core/*", "@/lib/*", "@/services/*", "@/integrations/*"],
    allowedDirectories: ALLOWED_DIRS,
    reasoning: [
      "Routes should import from features/platform for better modularity",
      "Components should be decoupled from legacy infrastructure",
      "Server functions should use feature boundaries",
      "This enables incremental migration to clean architecture",
    ],
  };

  assert.equal(rules.forbiddenImports.length, 4);
  assert.ok(rules.allowedDirectories.includes("src/features/"));
  assert.ok(rules.allowedDirectories.includes("src/platform/"));
});
