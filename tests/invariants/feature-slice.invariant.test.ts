/**
 * Feature-slice architecture invariant tests.
 *
 * Locks boundary rules for vertical slices (estimate, ai-upload, ai-design).
 * See docs/architecture/FEATURE_SLICE.md.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

const IO_PATTERNS = [
  /\bfrom ["']@\/platform\//,
  /\bfrom ["']openai["']/,
  /\bfrom ["']@supabase\/supabase-js["']/,
  /\bcreateServerFn\b/,
  /\bimport\.meta\b/,
];

const SLICES = [
  {
    name: "estimate",
    domainDir: join(ROOT, "src/features/estimate/domain"),
    applicationDir: join(ROOT, "src/features/estimate/application"),
    infrastructureDir: join(ROOT, "src/features/estimate/infrastructure"),
    indexFile: join(ROOT, "src/features/estimate/index.ts"),
  },
  {
    name: "ai-upload",
    domainDir: join(ROOT, "src/features/ai-upload/domain"),
    applicationDir: join(ROOT, "src/features/ai-upload/application"),
    infrastructureDir: join(ROOT, "src/features/ai-upload/infrastructure"),
    indexFile: join(ROOT, "src/features/ai-upload/index.ts"),
  },
  {
    name: "ai-design",
    domainDir: join(ROOT, "src/features/ai-design/domain"),
    applicationDir: join(ROOT, "src/features/ai-design/application"),
    infrastructureDir: join(ROOT, "src/features/ai-design/infrastructure"),
    indexFile: join(ROOT, "src/features/ai-design/index.ts"),
  },
  {
    name: "export",
    domainDir: join(ROOT, "src/features/export/domain"),
    applicationDir: join(ROOT, "src/features/export/application"),
    infrastructureDir: join(ROOT, "src/features/export/infrastructure"),
    indexFile: join(ROOT, "src/features/export/index.ts"),
  },
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

function readTrimmed(path: string): string {
  return readFileSync(path, "utf8").trim();
}

for (const slice of SLICES) {
  test(`${slice.name} slice — public index.ts exists`, () => {
    assert.ok(existsSync(slice.indexFile), `Missing slice index: ${slice.indexFile}`);
  });

  test(`${slice.name} slice — domain layer has no IO imports`, () => {
    for (const file of listTsFiles(slice.domainDir)) {
      const content = readTrimmed(file);
      for (const pattern of IO_PATTERNS) {
        assert.doesNotMatch(content, pattern, `IO leak in ${file}: matched ${pattern}`);
      }
      assert.doesNotMatch(content, /\bsupabase\b/i, `supabase reference in domain: ${file}`);
      assert.doesNotMatch(content, /\bopenai\b/i, `openai reference in domain: ${file}`);
    }
  });

  test(`${slice.name} slice — application layer does not import infrastructure or presentation`, () => {
    for (const file of listTsFiles(slice.applicationDir)) {
      const content = readTrimmed(file);
      assert.doesNotMatch(
        content,
        /from ["']@\/features\/[^"']+\/infrastructure/,
        `application imports infrastructure: ${file}`,
      );
      assert.doesNotMatch(
        content,
        /from ["']@\/features\/[^"']+\/presentation/,
        `application imports presentation: ${file}`,
      );
    }
  });

  test(`${slice.name} slice — infrastructure uses platform seam for vendors (no direct openai SDK)`, () => {
    for (const file of listTsFiles(slice.infrastructureDir)) {
      const content = readTrimmed(file);
      assert.doesNotMatch(
        content,
        /from ["']openai["']/,
        `direct openai import in infrastructure: ${file}`,
      );
      assert.doesNotMatch(
        content,
        /from ["']@supabase\/supabase-js["']/,
        `direct supabase-js import in infrastructure: ${file}`,
      );
      if (content.includes("getOpenAIClient") || content.includes("createServerSupabase")) {
        assert.match(content, /@\/platform\//, `vendor client without platform seam: ${file}`);
      }
    }
  });
}

test("ai-upload presentation serverFns validates input and uses dynamic adapter import", () => {
  const serverFns = readTrimmed(join(ROOT, "src/features/ai-upload/presentation/serverFns.ts"));
  assert.match(serverFns, /\.inputValidator\(/);
  assert.match(serverFns, /requireServerAuth/);
  assert.match(serverFns, /ai-vision\.adapter\.server/);
  assert.match(serverFns, /await import\(/);
});

test("ai-design presentation serverFns validates input and uses dynamic adapter imports", () => {
  const serverFns = readTrimmed(join(ROOT, "src/features/ai-design/presentation/serverFns.ts"));
  assert.match(serverFns, /\.inputValidator\(/);
  assert.match(serverFns, /requireServerAuth/);
  assert.match(serverFns, /ai-redesign\.adapter\.server/);
  assert.match(serverFns, /ai-scope\.adapter\.server/);
  assert.match(serverFns, /await import\(/);
});

test("estimate presentation serverFns validates input and uses dynamic adapter import", () => {
  const serverFns = readTrimmed(join(ROOT, "src/features/estimate/presentation/serverFns.ts"));
  assert.match(serverFns, /\.inputValidator\(/);
  assert.match(serverFns, /requireServerAuth/);
  assert.match(serverFns, /ai-estimate\.adapter\.server/);
  assert.match(serverFns, /await import\(/);
});
