/**
 * PH-SENTRY-1B2A — TanStack Start server.entry is resolved relative to
 * srcDirectory (default "src"), not the repository root.
 *
 * Canonical custom entry: src/server.ts → configure as "./server.ts".
 * Misconfiguring "./src/server.ts" silently falls back to the package
 * default entry and strands process/cold-start bootstraps.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

const CONFIG_FILES = ["vite.config.ts", "vite.vercel.config.ts"] as const;

/** Canonical TanStack server.entry value (relative to srcDirectory). */
const CANONICAL_SERVER_ENTRY = "./server.ts";

/**
 * Extract the server.entry string from a Vite config that configures
 * tanstackStart({ server: { entry: "..." } }).
 * Focused lexical match — not a full Vite config snapshot.
 */
function extractServerEntry(source: string): string | null {
  const serverBlock = source.match(/server\s*:\s*\{[^}]*\}/s);
  if (!serverBlock) return null;
  const entryMatch = serverBlock[0].match(/entry\s*:\s*["']([^"']+)["']/);
  return entryMatch?.[1] ?? null;
}

function isForbiddenEntry(entry: string): boolean {
  // Paths that double-prefix srcDirectory or point outside the intended file.
  return (
    entry === "./src/server.ts" ||
    entry === "src/server.ts" ||
    entry === "/src/server.ts" ||
    entry.endsWith("/src/server.ts")
  );
}

test("server-entry authority — src/server.ts exists as the custom server entry module", () => {
  assert.ok(
    existsSync(join(ROOT, "src/server.ts")),
    "src/server.ts must exist as the production server bootstrap authority",
  );
});

for (const configFile of CONFIG_FILES) {
  test(`server-entry authority — ${configFile} configures ./server.ts`, () => {
    const path = join(ROOT, configFile);
    assert.ok(existsSync(path), `${configFile} must exist`);
    const source = readFileSync(path, "utf8");

    assert.match(source, /tanstackStart\s*\(/, `${configFile} must call tanstackStart(...)`);

    const entry = extractServerEntry(source);
    assert.ok(
      entry,
      `${configFile} must explicitly configure server.entry (no silent package default)`,
    );
    assert.equal(
      entry,
      CANONICAL_SERVER_ENTRY,
      `${configFile} server.entry must be ${CANONICAL_SERVER_ENTRY} (got ${JSON.stringify(entry)})`,
    );
    assert.ok(
      !isForbiddenEntry(entry),
      `${configFile} must not use a src-prefixed entry that double-resolves under srcDirectory`,
    );
  });
}

test("server-entry authority — local and Vercel configs share the same server.entry", () => {
  const entries = CONFIG_FILES.map((file) => {
    const source = readFileSync(join(ROOT, file), "utf8");
    return extractServerEntry(source);
  });
  assert.equal(
    entries[0],
    entries[1],
    "vite.config.ts and vite.vercel.config.ts must configure the same server.entry",
  );
  assert.equal(entries[0], CANONICAL_SERVER_ENTRY);
});
