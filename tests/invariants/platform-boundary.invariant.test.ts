/**
 * Platform boundary invariant tests.
 *
 * Ensures vendor SDKs are only imported from approved layers. See
 * docs/architecture/platform-boundary.md.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const SRC = join(ROOT, "src");

const VENDOR_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "openai", pattern: /\bfrom ["']openai["']/ },
  { name: "posthog-js", pattern: /\bfrom ["']posthog-js["']/ },
  { name: "posthog-node", pattern: /\bfrom ["']posthog-node["']/ },
  { name: "@posthog/react", pattern: /\bfrom ["']@posthog\/react["']/ },
  { name: "@posthog/ai", pattern: /\bfrom ["']@posthog\/ai/ },
  { name: "@supabase/supabase-js", pattern: /\bfrom ["']@supabase\/supabase-js["']/ },
  { name: "@supabase/ssr", pattern: /\bfrom ["']@supabase\/ssr["']/ },
];

function isApprovedVendorPath(file: string): boolean {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  if (rel.startsWith("src/platform/")) return true;
  if (rel.startsWith("packages/supabase/")) return true;
  return false;
}

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

test("platform boundary — vendor SDK imports only in approved layers", () => {
  const violations: string[] = [];

  for (const file of listTsFiles(SRC)) {
    if (isApprovedVendorPath(file)) continue;

    const content = readTrimmed(file);
    for (const { name, pattern } of VENDOR_PATTERNS) {
      if (pattern.test(content)) {
        violations.push(`${relative(ROOT, file)}: direct ${name} import`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Vendor SDK imports outside src/platform/:\n${violations.join("\n")}`,
  );
});

test("platform boundary — OpenAI implementation lives in src/platform/openai", () => {
  const platformOpenAi = readTrimmed(join(SRC, "platform/openai/server.ts"));
  assert.match(platformOpenAi, /\bfrom ["']openai["']/);
  assert.match(platformOpenAi, /export function getOpenAIClient/);

  const coreShim = readTrimmed(join(SRC, "core/ai/server/openai-client.ts"));
  assert.doesNotMatch(coreShim, /\bfrom ["']openai["']/);
  assert.match(coreShim, /@\/platform\/openai\/server/);
  assert.match(coreShim, /TODO\(feature-slice\)/);
});

test("platform boundary — PostHog shims delegate to platform", () => {
  const serverShim = readTrimmed(join(SRC, "lib/posthog-server.ts"));
  assert.match(serverShim, /@\/platform\/posthog\/server/);
  assert.doesNotMatch(serverShim, /\bfrom ["']posthog-node["']/);

  const otelShim = readTrimmed(join(SRC, "lib/posthog-otel.ts"));
  assert.match(otelShim, /@\/platform\/posthog\/otel\.server/);
});

test("platform boundary — server aggregate does not import legacy openai-client", () => {
  const serverAggregate = readTrimmed(join(SRC, "platform/server.ts"));
  assert.doesNotMatch(serverAggregate, /@\/core\/ai\/server\/openai-client/);
  assert.match(serverAggregate, /@\/platform\/openai\/server/);
  assert.match(serverAggregate, /@\/platform\/posthog\/server/);
});

test("platform boundary — browser and server aggregates exist and are separate", () => {
  assert.ok(existsSync(join(SRC, "platform/browser.ts")));
  assert.ok(existsSync(join(SRC, "platform/server.ts")));

  const browser = readTrimmed(join(SRC, "platform/browser.ts"));
  const server = readTrimmed(join(SRC, "platform/server.ts"));

  assert.doesNotMatch(browser, /getOpenAIClient/);
  assert.match(server, /getOpenAIClient/);
});

test("platform boundary — no mixed browser/server platform barrel", () => {
  const platformIndex = join(SRC, "platform/index.ts");
  assert.ok(!existsSync(platformIndex), "src/platform/index.ts must not exist (mixed barrel risk)");
});

test("platform boundary — Nitro server entry uses platform OTEL bootstrap", () => {
  const serverEntry = readTrimmed(join(SRC, "server.ts"));
  assert.match(serverEntry, /@\/platform\/posthog\/otel\.server/);
});
