/**
 * Legacy shim cleanup invariant tests.
 *
 * Deleted strangler shims must not be recreated. Importers use feature slices
 * and src/platform/ directly. See docs/architecture/FEATURE_SLICE.md.
 *
 * For broader architectural boundary enforcement (preventing direct legacy imports
 * outside features/platform), see tests/invariants/no-legacy-imports.invariant.test.ts
 * and docs/architecture/audit-2026-06-10.md.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const SRC = join(ROOT, "src");

/** Paths that were removed during June 2026 shim cleanup — must stay gone. */
const DELETED_SHIM_PATHS = [
  "src/core/ai/server/openai-client.ts",
  "src/lib/posthog-server.ts",
  "src/lib/posthog-otel.ts",
  "src/services/supabase/index.ts",
  "src/services/supabase/_client.ts",
  "src/lib/estimates.ts",
  "src/lib/scopeAnalysis.ts",
  "src/lib/analysis.ts",
  "src/hooks/useAIEstimate.ts",
  "src/hooks/useScopeAnalysis.ts",
  "src/hooks/useScopeAnalysisPersistence.ts",
  "src/hooks/usePhotos.ts",
  "src/core/ai/serverFns.ts",
  "src/core/ai/server/openAiEstimate.server.ts",
  "src/core/ai/server/openAiVision.server.ts",
  "src/core/ai/server/openAiRedesign.server.ts",
  "src/core/ai/server/openAiScopeAnalysis.server.ts",
  "src/core/ai/photoAnalysis.ts",
  "src/core/ai/mockAnalysis.ts",
  "src/core/ai/redesignConcepts.ts",
] as const;

const FORBIDDEN_IMPORT_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "@/services/supabase", pattern: /\bfrom ["']@\/services\/supabase/ },
  { name: "@/lib/posthog-server", pattern: /\bfrom ["']@\/lib\/posthog-server/ },
  { name: "@/lib/posthog-otel", pattern: /\bfrom ["']@\/lib\/posthog-otel/ },
  { name: "@/lib/analysis", pattern: /\bfrom ["']@\/lib\/analysis/ },
  { name: "@/lib/estimates", pattern: /\bfrom ["']@\/lib\/estimates/ },
  { name: "@/lib/scopeAnalysis", pattern: /\bfrom ["']@\/lib\/scopeAnalysis/ },
  { name: "@/hooks/usePhotos", pattern: /\bfrom ["']@\/hooks\/usePhotos/ },
  { name: "@/hooks/useAIEstimate", pattern: /\bfrom ["']@\/hooks\/useAIEstimate/ },
  { name: "@/hooks/useScopeAnalysis", pattern: /\bfrom ["']@\/hooks\/useScopeAnalysis/ },
  {
    name: "@/core/ai/serverFns",
    pattern: /\bfrom ["']@\/core\/ai\/serverFns/,
  },
  {
    name: "openai-client shim",
    pattern: /\bfrom ["']@\/core\/ai\/server\/openai-client/,
  },
  {
    name: "openAiEstimate.server shim",
    pattern: /\bfrom ["']@\/core\/ai\/server\/openAiEstimate\.server/,
  },
  {
    name: "openAiVision.server shim",
    pattern: /\bfrom ["']@\/core\/ai\/server\/openAiVision\.server/,
  },
  {
    name: "openAiScopeAnalysis.server shim",
    pattern: /\bfrom ["']@\/core\/ai\/server\/openAiScopeAnalysis\.server/,
  },
  {
    name: "openAiRedesign.server shim",
    pattern: /\bfrom ["']@\/core\/ai\/server\/openAiRedesign\.server/,
  },
  {
    name: "@/core/ai/platform/orchestrator deep import",
    pattern: /\bfrom ["']@\/core\/ai\/platform\/orchestrator/,
  },
  {
    name: "@/integrations/supabase/client deprecated shim",
    pattern: /\bfrom ["']@\/integrations\/supabase\/client/,
  },
];

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

test("shim cleanup — deleted shim files must not exist", () => {
  const present = DELETED_SHIM_PATHS.filter((p) => existsSync(join(ROOT, p)));
  assert.deepEqual(present, [], `Deleted shims recreated:\n${present.join("\n")}`);
});

test("shim cleanup — no imports of deleted shim paths", () => {
  const violations: string[] = [];

  for (const file of listTsFiles(SRC)) {
    const content = readFileSync(file, "utf8");
    for (const { name, pattern } of FORBIDDEN_IMPORT_PATTERNS) {
      if (pattern.test(content)) {
        violations.push(`${relative(ROOT, file)}: ${name}`);
      }
    }
  }

  assert.deepEqual(violations, [], `Imports of deleted shims:\n${violations.join("\n")}`);
});

test("shim cleanup — Supabase singleton lives in platform", () => {
  assert.ok(existsSync(join(SRC, "platform/supabase/_client.ts")));
  assert.ok(existsSync(join(SRC, "platform/supabase/browser.ts")));
  const browser = readFileSync(join(SRC, "platform/supabase/browser.ts"), "utf8");
  assert.match(browser, /export \{ supabase \} from "\.\/_client"/);
  assert.doesNotMatch(browser, /@\/services\/supabase/);
});

test("shim cleanup — no TODO(feature-slice) markers remain in src", () => {
  const hits: string[] = [];
  for (const file of listTsFiles(SRC)) {
    const content = readFileSync(file, "utf8");
    if (content.includes("TODO(feature-slice)")) {
      hits.push(relative(ROOT, file));
    }
  }
  assert.deepEqual(hits, [], `Stale TODO(feature-slice) markers:\n${hits.join("\n")}`);
});

test("shim cleanup — legacy compatibility shim imports stay constrained", () => {
  const libEstimateImporters: string[] = [];
  const integrationsClientImporters: string[] = [];

  for (const file of listTsFiles(SRC)) {
    const relPath = relative(ROOT, file);
    const content = readFileSync(file, "utf8");
    if (/\bfrom ["']@\/lib\/estimate["']/.test(content)) {
      libEstimateImporters.push(relPath);
    }
    if (/\bfrom ["']@\/integrations\/supabase\/client["']/.test(content)) {
      integrationsClientImporters.push(relPath);
    }
  }

  assert.deepEqual(
    libEstimateImporters,
    ["src/core/pricing/index.ts"],
    `@/lib/estimate should only be imported by core pricing compatibility barrel:\n${libEstimateImporters.join("\n")}`,
  );

  assert.deepEqual(
    integrationsClientImporters,
    [],
    `@/integrations/supabase/client is deprecated and must not be imported:\n${integrationsClientImporters.join("\n")}`,
  );
});
