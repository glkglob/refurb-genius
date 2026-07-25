/**
 * C4c-1 — Projects list query-key contract.
 *
 * Runtime Projects list cache operations must use projectKeys.all from
 * src/lib/queries/projects.ts. Raw ["projects"] / ['projects'] query-key
 * literals are forbidden outside the canonical factory definition.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const CANONICAL_FACTORY = "src/lib/queries/projects.ts";
const REQUIRED_REPLACEMENT = "projectKeys.all (from @/lib/queries/projects)";

/** Roots scanned for raw Projects list query keys and duplicate factories. */
const SCAN_ROOTS = [
  join(ROOT, "src/hooks"),
  join(ROOT, "src/lib"),
  join(ROOT, "src/routes"),
  join(ROOT, "src/features"),
  join(ROOT, "src/components"),
  join(ROOT, "src/core"),
] as const;

/**
 * API contexts where a Projects list key array is treated as a React Query key.
 * Tight matching avoids .from("projects"), table registries, and prose.
 */
const QUERY_KEY_API_CONTEXT =
  /(?:queryKey\s*:\s*|invalidateQueries\s*\(\s*\{[^}]*queryKey\s*:\s*|cancelQueries\s*\(\s*\{[^}]*queryKey\s*:\s*|removeQueries\s*\(\s*\{[^}]*queryKey\s*:\s*|resetQueries\s*\(\s*\{[^}]*queryKey\s*:\s*|refetchQueries\s*\(\s*\{[^}]*queryKey\s*:\s*|getQueryData(?:<[^>]*>)?\s*\(\s*|setQueryData(?:<[^>]*>)?\s*\(\s*|fetchQuery\s*\(\s*\{[^}]*queryKey\s*:\s*|ensureQueryData\s*\(\s*\{[^}]*queryKey\s*:)/;

/** Raw list key literal: ["projects"] or ['projects'] (optional whitespace). */
const RAW_LIST_KEY = /\[\s*['"]projects['"]\s*\]/;

/** Combined: API context immediately before a raw list key (same line, flexible gap). */
const FORBIDDEN_RAW_KEY_ON_LINE =
  /(?:queryKey\s*:\s*|invalidateQueries\s*\(\s*\{[^}\n]*queryKey\s*:\s*|cancelQueries\s*\(\s*\{[^}\n]*queryKey\s*:\s*|removeQueries\s*\(\s*\{[^}\n]*queryKey\s*:\s*|resetQueries\s*\(\s*\{[^}\n]*queryKey\s*:\s*|refetchQueries\s*\(\s*\{[^}\n]*queryKey\s*:\s*|getQueryData(?:<[^>]*>)?\s*\(\s*|setQueryData(?:<[^>]*>)?\s*\(\s*|fetchQuery\s*\(\s*\{[^}\n]*queryKey\s*:\s*|ensureQueryData\s*\(\s*\{[^}\n]*queryKey\s*:)\s*\[\s*['"]projects['"]\s*\]/;

const PROJECT_KEYS_EXPORT = /export\s+const\s+projectKeys\s*=/;

function listTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const ents = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of ents) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      // Skip vitest/unit tests under src (key identity tests may quote literals)
      if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) continue;
      if (entry.name.endsWith(".spec.ts") || entry.name.endsWith(".spec.tsx")) continue;
      files.push(full);
    }
  }
  return files;
}

function stripLineComments(line: string): string {
  // Drop // comments; avoid stripping inside simple :// URLs
  const idx = line.indexOf("//");
  if (idx === -1) return line;
  const before = line.slice(0, idx);
  if (before.endsWith(":")) return line;
  return before;
}

export type RawKeyHit = {
  file: string;
  line: number;
  forbidden: string;
};

/**
 * Detect forbidden raw Projects list keys in query API contexts.
 * Exported for self-contained fixture probes (not production scans).
 */
export function findRawProjectsListKeys(content: string, fileLabel = "fixture"): RawKeyHit[] {
  const hits: RawKeyHit[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = stripLineComments(lines[i] ?? "");
    if (!RAW_LIST_KEY.test(line)) continue;
    if (!FORBIDDEN_RAW_KEY_ON_LINE.test(line) && !QUERY_KEY_API_CONTEXT.test(line)) {
      // Allow bare ["projects"] only when not in query API context (factory all:, tables, etc.)
      // Still forbid if the line is clearly a queryKey assignment without nested whitespace issues
      if (
        !/\bqueryKey\b/.test(line) &&
        !/\b(?:get|set)QueryData\b/.test(line) &&
        !/\b(?:invalidate|cancel|remove|reset|refetch)Queries\b/.test(line)
      ) {
        continue;
      }
    }
    // Canonical factory definition: `all: ["projects"] as const` is allowed only in factory file
    if (/^\s*all\s*:\s*\[\s*['"]projects['"]\s*\]/.test(line)) {
      continue;
    }
    if (
      FORBIDDEN_RAW_KEY_ON_LINE.test(line) ||
      (/\bqueryKey\b|\b(?:get|set)QueryData\b|\b(?:invalidate|cancel|remove|reset|refetch)Queries\b/.test(
        line,
      ) &&
        RAW_LIST_KEY.test(line))
    ) {
      hits.push({
        file: fileLabel,
        line: i + 1,
        forbidden: line.trim(),
      });
    }
  }
  return hits;
}

function formatHit(hit: RawKeyHit): string {
  return (
    `${hit.file}:${hit.line}: forbidden raw Projects list key\n` +
    `  forbidden usage: ${hit.forbidden}\n` +
    `  required canonical replacement: ${REQUIRED_REPLACEMENT}`
  );
}

test("projects query keys — single projectKeys factory in src/lib/queries/projects.ts", () => {
  const defs: string[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of listTsFiles(root)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      const text = readFileSync(file, "utf8");
      if (PROJECT_KEYS_EXPORT.test(text)) {
        defs.push(rel);
      }
    }
  }
  assert.deepEqual(
    defs,
    [CANONICAL_FACTORY],
    `expected exactly one projectKeys factory at ${CANONICAL_FACTORY}, found:\n${defs.join("\n") || "(none)"}`,
  );
});

test("projects query keys — no raw list key literals in runtime query APIs", () => {
  const violations: string[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of listTsFiles(root)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      // Factory may define all: ["projects"]
      if (rel === CANONICAL_FACTORY) continue;
      const text = readFileSync(file, "utf8");
      for (const hit of findRawProjectsListKeys(text, rel)) {
        violations.push(formatHit(hit));
      }
    }
  }
  assert.equal(violations.length, 0, violations.join("\n\n"));
});

test("projects query keys — useProjects list operations use projectKeys.all", () => {
  const hookPath = join(ROOT, "src/hooks/useProjects.ts");
  assert.ok(existsSync(hookPath), "missing src/hooks/useProjects.ts");
  const text = readFileSync(hookPath, "utf8");
  assert.match(
    text,
    /from\s+["']@\/lib\/queries\/projects["']/,
    "useProjects must import projectKeys from @/lib/queries/projects",
  );
  assert.match(text, /projectKeys\.all/, "useProjects must reference projectKeys.all");
  assert.equal(
    findRawProjectsListKeys(text, "src/hooks/useProjects.ts").length,
    0,
    "useProjects must not contain raw Projects list query keys",
  );
  // Ensure the six list-cache call sites use the factory (not a different key)
  assert.match(text, /queryKey:\s*projectKeys\.all/);
  assert.match(text, /invalidateQueries\(\{\s*queryKey:\s*projectKeys\.all\s*\}\)/);
  assert.match(text, /cancelQueries\(\{\s*queryKey:\s*projectKeys\.all\s*\}\)/);
  assert.match(text, /getQueryData(?:<[^>]*>)?\(\s*projectKeys\.all\s*\)/);
  assert.match(text, /setQueryData(?:<[^>]*>)?\(\s*projectKeys\.all\s*,/);
});

// ─── Self-contained negative / positive probes (no production file mutation) ─

test('projects query keys — probe: raw queryKey ["projects"] rejected', () => {
  const hits = findRawProjectsListKeys(`const opts = { queryKey: ["projects"] };`, "probe");
  assert.ok(hits.length >= 1, "expected raw queryKey to be rejected");
});

test("projects query keys — probe: raw invalidateQueries rejected", () => {
  const hits = findRawProjectsListKeys(
    `queryClient.invalidateQueries({ queryKey: ["projects"] });`,
    "probe",
  );
  assert.ok(hits.length >= 1, "expected raw invalidateQueries to be rejected");
});

test("projects query keys — probe: raw cancelQueries rejected", () => {
  const hits = findRawProjectsListKeys(
    `await queryClient.cancelQueries({ queryKey: ['projects'] });`,
    "probe",
  );
  assert.ok(hits.length >= 1, "expected raw cancelQueries to be rejected");
});

test("projects query keys — probe: raw getQueryData / setQueryData rejected", () => {
  const getHits = findRawProjectsListKeys(
    `const previous = queryClient.getQueryData(["projects"]);`,
    "probe",
  );
  const setHits = findRawProjectsListKeys(
    `queryClient.setQueryData(["projects"], previous);`,
    "probe",
  );
  assert.ok(getHits.length >= 1, "expected raw getQueryData to be rejected");
  assert.ok(setHits.length >= 1, "expected raw setQueryData to be rejected");
});

test("projects query keys — probe: projectKeys.all accepted", () => {
  const sample = `
    queryKey: projectKeys.all,
    queryClient.invalidateQueries({ queryKey: projectKeys.all });
    queryClient.setQueryData(projectKeys.all, previous);
  `;
  assert.equal(findRawProjectsListKeys(sample, "probe").length, 0);
});

test("projects query keys — probe: supabase.from projects table accepted", () => {
  const sample = 'const { data } = await supabase.from("projects").select("*");';
  assert.equal(findRawProjectsListKeys(sample, "probe").length, 0);
});

test('projects query keys — probe: ["project-catalog"] accepted', () => {
  const sample = `queryKey: ["project-catalog"]`;
  assert.equal(findRawProjectsListKeys(sample, "probe").length, 0);
});

test("projects query keys — probe: database table declaration accepted", () => {
  const sample = `tables: ["projects"],`;
  assert.equal(findRawProjectsListKeys(sample, "probe").length, 0);
});

test("projects query keys — probe: factory all definition accepted", () => {
  const sample = `  all: ["projects"] as const,`;
  assert.equal(findRawProjectsListKeys(sample, "probe").length, 0);
});

test("projects query keys — probe: second projectKeys factory rejected by scanner scope", () => {
  // The production scan counts export const projectKeys; fixture proves the pattern.
  assert.match(`export const projectKeys = { all: ["projects"] as const };`, PROJECT_KEYS_EXPORT);
});
