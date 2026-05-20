/**
 * Auth / environment variable security invariant tests.
 *
 * Guards against accidentally exposing server-side secrets in client bundles.
 * These tests scan source files statically — no runtime dependencies needed.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

/** Recursively collect all .ts/.tsx files under a directory. */
function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".vercel") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectSourceFiles(full, files);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

/** Return files (relative paths) whose content matches the given string. */
function filesContaining(files: string[], needle: string): string[] {
  return files
    .filter((f) => readFileSync(f, "utf8").includes(needle))
    .map((f) => relative(ROOT, f));
}

// Collect all source files once
const SRC_FILES = collectSourceFiles(join(ROOT, "src"));
const PKG_FILES = collectSourceFiles(join(ROOT, "packages"));
const ALL_SOURCE = [...SRC_FILES, ...PKG_FILES];

test("VITE_SUPABASE_SERVICE_ROLE_KEY is never referenced in any source file", () => {
  const hits = filesContaining(ALL_SOURCE, "VITE_SUPABASE_SERVICE_ROLE_KEY");

  assert.deepEqual(
    hits,
    [],
    `VITE_SUPABASE_SERVICE_ROLE_KEY would expose the service role key in the browser bundle.\n` +
      `Found in: ${hits.join(", ")}`,
  );
});

test("VITE_OPENAI_API_KEY is never referenced in any source file", () => {
  const hits = filesContaining(ALL_SOURCE, "VITE_OPENAI_API_KEY");

  assert.deepEqual(
    hits,
    [],
    `VITE_OPENAI_API_KEY would expose the OpenAI API key in the browser bundle.\n` +
      `Found in: ${hits.join(", ")}`,
  );
});

test("client Supabase module does not reference SERVICE_ROLE_KEY", () => {
  const clientFile = join(ROOT, "src/integrations/supabase/client.ts");
  const source = readFileSync(clientFile, "utf8");

  assert.ok(
    !source.includes("SERVICE_ROLE_KEY"),
    "src/integrations/supabase/client.ts must not reference SERVICE_ROLE_KEY",
  );
  assert.ok(
    !source.includes("service_role"),
    "src/integrations/supabase/client.ts must not reference service_role",
  );
});

test("client Supabase module does not import client.server", () => {
  // No file in src/ (except client.server.ts itself) should import supabaseAdmin
  // or reference client.server directly.
  const forbidden = ["client.server", "supabaseAdmin"];
  for (const needle of forbidden) {
    const hits = filesContaining(
      SRC_FILES.filter((f) => !f.includes("client.server")),
      needle,
    );
    assert.deepEqual(
      hits,
      [],
      `"${needle}" must not be imported in client-side code.\nFound in: ${hits.join(", ")}`,
    );
  }
});

test("server-only OpenAI files use process.env.OPENAI_API_KEY, not VITE_ prefix", () => {
  const serverFiles = ALL_SOURCE.filter((f) => f.includes("openAi") || f.includes("openai"));

  for (const file of serverFiles) {
    const source = readFileSync(file, "utf8");
    if (source.includes("OPENAI_API_KEY")) {
      assert.ok(
        !source.includes("VITE_OPENAI_API_KEY"),
        `${relative(ROOT, file)}: OpenAI key must use process.env.OPENAI_API_KEY, not VITE_ prefix`,
      );
      assert.ok(
        source.includes("process.env.OPENAI_API_KEY"),
        `${relative(ROOT, file)}: OpenAI key must be read from process.env (server-only)`,
      );
    }
  }
});

test(".env.example documents SUPABASE_SERVICE_ROLE_KEY as server-only", () => {
  const envExample = readFileSync(join(ROOT, ".env.example"), "utf8");

  assert.ok(
    envExample.includes("SUPABASE_SERVICE_ROLE_KEY"),
    ".env.example must document SUPABASE_SERVICE_ROLE_KEY",
  );
  // Must NOT have VITE_ prefix for service role key
  assert.ok(
    !envExample.includes("VITE_SUPABASE_SERVICE_ROLE_KEY"),
    ".env.example must not have VITE_SUPABASE_SERVICE_ROLE_KEY (would expose it client-side)",
  );
});

test(".env.example documents OPENAI_API_KEY as server-only (no VITE_ prefix)", () => {
  const envExample = readFileSync(join(ROOT, ".env.example"), "utf8");

  assert.ok(envExample.includes("OPENAI_API_KEY"), ".env.example must document OPENAI_API_KEY");
  assert.ok(
    !envExample.includes("VITE_OPENAI_API_KEY"),
    ".env.example must not have VITE_OPENAI_API_KEY (would expose it client-side)",
  );
});

test(".env.example documents VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as client-safe vars", () => {
  const envExample = readFileSync(join(ROOT, ".env.example"), "utf8");

  assert.ok(
    envExample.includes("VITE_SUPABASE_URL"),
    ".env.example must document the client-safe VITE_SUPABASE_URL",
  );
  assert.ok(
    envExample.includes("VITE_SUPABASE_ANON_KEY"),
    ".env.example must document the client-safe VITE_SUPABASE_ANON_KEY",
  );
});
