/**
 * Architectural Invariant: No Direct Legacy Imports
 *
 * Enforcement is deferred until the documented legacy-import migration is complete.
 * See: docs/architecture/audit-2026-06-10.md
 */

import assert from "node:assert/strict";
import test from "node:test";

const FORBIDDEN_IMPORTS = ["@/core/*", "@/lib/*", "@/services/*", "@/integrations/*"];
const ALLOWED_DIRS = [
  "src/features/",
  "src/platform/",
  "src/core/",
  "src/lib/",
  "src/integrations/",
  "src/services/",
  "src/types/",
];

test.todo(
  "enforces the no-legacy-imports boundary once the documented migration baseline is remediated",
);

test("documents the architectural boundary rules", () => {
  const rules = {
    forbiddenImports: FORBIDDEN_IMPORTS,
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
