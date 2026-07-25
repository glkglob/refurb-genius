/**
 * C4c-1 / C4c-2 — Projects list + detail query-key contract.
 *
 * C4c-1: Runtime Projects list cache operations must use projectKeys.all from
 * src/lib/queries/projects.ts. Raw ["projects"] / ['projects'] query-key
 * literals are forbidden outside the canonical factory definition.
 *
 * C4c-2: useProject must not derive a single project from the list cache
 * (useProjects + .find). It must use projectQueryOptions / projectKeys.byId.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const CANONICAL_FACTORY = "src/lib/queries/projects.ts";
const USE_PROJECTS_HOOK = "src/hooks/useProjects.ts";
const REQUIRED_REPLACEMENT = "projectKeys.all (from @/lib/queries/projects)";
const REQUIRED_DETAIL_REPLACEMENT =
  "projectQueryOptions(id) / projectKeys.byId (canonical detail; not list-derived find)";

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
    "useProjects must import from @/lib/queries/projects",
  );
  assert.match(
    text,
    /projectsListQueryOptions\s*\(/,
    "useProjects must call projectsListQueryOptions() (C4c-6 shared list authority)",
  );
  assert.match(
    text,
    /projectKeys\.all/,
    "useProjects must reference projectKeys.all for mutations",
  );
  assert.equal(
    findRawProjectsListKeys(text, "src/hooks/useProjects.ts").length,
    0,
    "useProjects must not contain raw Projects list query keys",
  );
  assert.match(
    text,
    /invalidateQueries\(\{\s*queryKey:\s*projectKeys\.all\s*,\s*exact:\s*true\s*\}\)/,
    "create must invalidate projectKeys.all with exact: true",
  );
  assert.match(
    text,
    /cancelQueries\(\{\s*queryKey:\s*projectKeys\.all\s*,\s*exact:\s*true\s*\}\)/,
    "stage must cancel projectKeys.all with exact: true",
  );
  // List get/set + list query options live in the factory module
  const factoryPath = join(ROOT, CANONICAL_FACTORY);
  const factoryText = readFileSync(factoryPath, "utf8");
  assert.match(
    factoryText,
    /export\s+const\s+projectsListQueryOptions/,
    "factory must export projectsListQueryOptions",
  );
  assert.match(
    factoryText,
    /queryKey:\s*projectKeys\.all/,
    "projectsListQueryOptions must use projectKeys.all",
  );
  assert.match(factoryText, /getQueryData(?:<[^>]*>)?\(\s*projectKeys\.all\s*\)/);
  assert.match(factoryText, /setQueryData(?:<[^>]*>)?\(\s*projectKeys\.all\s*,/);
});

test("projects query keys — C4c-6 catalog adapter uses canonical list (no project-catalog)", () => {
  const catalogPath = join(
    ROOT,
    "src/features/feasibility/presentation/hooks/useProjectCatalog.ts",
  );
  assert.ok(existsSync(catalogPath), "missing useProjectCatalog");
  const text = readFileSync(catalogPath, "utf8");
  assert.match(
    text,
    /projectsListQueryOptions\s*\(/,
    "useProjectCatalog must call projectsListQueryOptions() (not merely import)",
  );
  assert.doesNotMatch(
    text,
    /\[\s*["']project-catalog["']\s*\]/,
    'useProjectCatalog must not use ["project-catalog"] key',
  );
  assert.doesNotMatch(
    text,
    /supabase\.from\s*\(\s*["']projects["']\s*\)/,
    "useProjectCatalog must not fetch Projects list directly",
  );
  assert.equal(
    findRawProjectsListKeys(text, "useProjectCatalog").length,
    0,
    "catalog must not use raw Projects list keys",
  );
});

test("projects query keys — no runtime project-catalog key under src", () => {
  const violations: string[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of listTsFiles(root)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
      const text = readFileSync(file, "utf8");
      // Strip // comments so migration notes do not false-positive
      const code = text
        .split("\n")
        .map((line) => {
          const idx = line.indexOf("//");
          if (idx === -1) return line;
          return line.slice(0, idx);
        })
        .join("\n");
      if (/\[\s*["']project-catalog["']\s*\]/.test(code)) {
        violations.push(rel);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `runtime ["project-catalog"] key forbidden under src:\n${violations.join("\n")}`,
  );
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

test('projects query keys — probe: ["project-catalog"] is forbidden at runtime (C4c-6)', () => {
  // Structural ban is production-scanned; probe documents the forbidden literal.
  const sample = `queryKey: ["project-catalog"]`;
  assert.match(sample, /\[\s*["']project-catalog["']\s*\]/);
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

// ─── C4c-2: useProject must not be list-derived ─────────────────────────────

export type ListDerivedHit = {
  file: string;
  forbidden: string;
  detail: string;
};

/**
 * Extract the body of `export function useProject(...) { ... }` (brace-balanced).
 * Static/regex-level extraction — not a full AST. Sufficient for this narrow hook.
 */
export function extractUseProjectBody(content: string): string | null {
  const match = content.match(/export\s+function\s+useProject\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/);
  if (!match || match.index === undefined) return null;
  const start = match.index + match[0].length - 1; // at '{'
  let depth = 0;
  for (let i = start; i < content.length; i++) {
    const ch = content[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return content.slice(start + 1, i);
      }
    }
  }
  return null;
}

/**
 * Detect list-derived single-project reads inside a useProject implementation.
 * Exported for fixture probes. Narrow: only flags useProjects() call + .find
 * derivation patterns, or missing canonical detail authority when useProject exists.
 */
export function findListDerivedUseProject(
  content: string,
  fileLabel = "fixture",
): ListDerivedHit[] {
  const body = extractUseProjectBody(content);
  if (body === null) return [];

  const hits: ListDerivedHit[] = [];

  // Forbidden: call useProjects() inside useProject (list derivation)
  if (/\buseProjects\s*\(/.test(body)) {
    hits.push({
      file: fileLabel,
      forbidden: "useProjects() inside useProject",
      detail: "useProject must not call useProjects; use projectQueryOptions / projectKeys.byId",
    });
  }

  // Forbidden: .find(...) used to pick a project from a collection
  if (/\.find\s*\(/.test(body)) {
    hits.push({
      file: fileLabel,
      forbidden: ".find(...) inside useProject",
      detail:
        "useProject must not derive a Project via .find on the list cache; use projectQueryOptions",
    });
  }

  // Required: must reference projectQueryOptions or projectKeys.byId
  const hasCanonical =
    /\bprojectQueryOptions\s*\(/.test(body) || /\bprojectKeys\.byId\s*\(/.test(body);
  if (!hasCanonical) {
    hits.push({
      file: fileLabel,
      forbidden: "missing canonical detail authority",
      detail: `useProject must use ${REQUIRED_DETAIL_REPLACEMENT}`,
    });
  }

  return hits;
}

function formatListDerivedHit(hit: ListDerivedHit): string {
  return (
    `${hit.file}: forbidden list-derived useProject\n` +
    `  forbidden pattern: ${hit.forbidden}\n` +
    `  required canonical replacement: ${REQUIRED_DETAIL_REPLACEMENT}\n` +
    `  detail: ${hit.detail}`
  );
}

test("projects query keys — C4c-2 useProject uses canonical detail (not list-derived)", () => {
  const hookPath = join(ROOT, USE_PROJECTS_HOOK);
  assert.ok(existsSync(hookPath), `missing ${USE_PROJECTS_HOOK}`);
  const text = readFileSync(hookPath, "utf8");
  const body = extractUseProjectBody(text);
  assert.ok(body !== null, "expected export function useProject in useProjects.ts");

  const hits = findListDerivedUseProject(text, USE_PROJECTS_HOOK);
  assert.equal(
    hits.length,
    0,
    hits.map(formatListDerivedHit).join("\n\n") || "unexpected list-derived useProject",
  );

  assert.match(
    text,
    /projectQueryOptions/,
    "useProjects.ts must reference projectQueryOptions for detail reads",
  );
  assert.match(body!, /projectQueryOptions\s*\(/, "useProject body must call projectQueryOptions");
  // useProject body must not call useProjects (list derivation)
  assert.equal(/\buseProjects\s*\(/.test(body!), false, "useProject must not call useProjects()");
  assert.equal(/\.find\s*\(/.test(body!), false, "useProject must not use .find(...)");
});

// ─── C4c-2 negative / positive probes ───────────────────────────────────────

test("C4c-2 probe: list-derived useProject with useProjects + find rejected", () => {
  const sample = `
export function useProject(id: string) {
  const { data } = useProjects();
  return { data: data?.find((project) => project.id === id) };
}
`;
  const hits = findListDerivedUseProject(sample, "probe-list-derived");
  assert.ok(hits.length >= 2, `expected useProjects + find hits, got: ${JSON.stringify(hits)}`);
  assert.ok(hits.some((h) => h.forbidden.includes("useProjects")));
  assert.ok(hits.some((h) => h.forbidden.includes(".find")));
});

test("C4c-2 probe: list-derived useProject with spread rest rejected", () => {
  const sample = `
export function useProject(id: string) {
  const projectsQuery = useProjects();
  const project = projectsQuery.data?.find((item) => item.id === id);
  return { ...projectsQuery, data: project };
}
`;
  const hits = findListDerivedUseProject(sample, "probe-spread");
  assert.ok(hits.length >= 2, `expected rejections, got: ${JSON.stringify(hits)}`);
});

test("C4c-2 probe: direct projectQueryOptions accepted", () => {
  const sample = `
export function useProject(id: string) {
  return useQuery(projectQueryOptions(id));
}
`;
  assert.equal(findListDerivedUseProject(sample, "probe-canonical").length, 0);
});

test("C4c-2 probe: projectQueryOptions with enabled override accepted", () => {
  const sample = `
export function useProject(id: string) {
  const query = useQuery({
    ...projectQueryOptions(id),
    enabled: Boolean(id),
  });
  return { ...query, isLoading: query.isPending };
}
`;
  assert.equal(findListDerivedUseProject(sample, "probe-enabled").length, 0);
});

test("C4c-2 probe: useProjects list hook itself not flagged as useProject", () => {
  const sample = `
export function useProjects() {
  return useQuery({ queryKey: projectKeys.all });
}
`;
  // No useProject export → scanner returns no hits
  assert.equal(findListDerivedUseProject(sample, "probe-list-only").length, 0);
});

test("C4c-2 probe: catalog-local .find outside useProject accepted", () => {
  const sample = `
export function useProjectCatalog() {
  const selected = catalogProjects.find((project) => project.id === id);
  return selected;
}
`;
  assert.equal(findListDerivedUseProject(sample, "probe-catalog").length, 0);
});

test("C4c-2 probe: useProject without canonical authority rejected", () => {
  const sample = `
export function useProject(id: string) {
  return useQuery({ queryKey: ["something", id], queryFn: async () => null });
}
`;
  const hits = findListDerivedUseProject(sample, "probe-no-canonical");
  assert.ok(
    hits.some((h) => h.forbidden.includes("missing canonical")),
    `expected missing-canonical hit, got: ${JSON.stringify(hits)}`,
  );
});

// ─── C4c-3: list/detail mutation synchronization ────────────────────────────

test("projects query keys — C4c-3 stage dual-cache sync uses exact list and detail keys", () => {
  const hookPath = join(ROOT, USE_PROJECTS_HOOK);
  const text = readFileSync(hookPath, "utf8");

  // Stage mutation must reference both authorities
  assert.match(text, /projectKeys\.byId/, "stage sync must reference projectKeys.byId");
  assert.match(
    text,
    /cancelQueries\(\{\s*queryKey:\s*projectKeys\.byId\([^)]+\)\s*,\s*exact:\s*true\s*\}\)/,
    "stage must cancel projectKeys.byId with exact: true",
  );
  assert.match(
    text,
    /cancelQueries\(\{\s*queryKey:\s*projectKeys\.all\s*,\s*exact:\s*true\s*\}\)/,
    "stage must cancel projectKeys.all with exact: true (not broad prefix)",
  );
  // Must use dual-cache optimistic helper (not list-only inline patch)
  assert.match(
    text,
    /applyProjectStageOptimistic/,
    "stage onMutate must use applyProjectStageOptimistic for dual-cache patch",
  );
  assert.match(
    text,
    /restoreProjectStageCaches/,
    "stage onError must use restoreProjectStageCaches",
  );

  // Forbid broad list-only cancel without exact (regression of pre-C4c-3 pattern)
  assert.equal(
    /cancelQueries\(\{\s*queryKey:\s*projectKeys\.all\s*\}\)/.test(text) &&
      !/cancelQueries\(\{\s*queryKey:\s*projectKeys\.all\s*,\s*exact:\s*true\s*\}\)/.test(text),
    false,
    "stage must not cancel projectKeys.all without exact: true",
  );
});

test("projects query keys — C4c-3 create seeds detail and exact-invalidates list", () => {
  const hookPath = join(ROOT, USE_PROJECTS_HOOK);
  const text = readFileSync(hookPath, "utf8");

  assert.match(
    text,
    /seedProjectDetailCache/,
    "create onSuccess must seed detail via seedProjectDetailCache",
  );
  assert.match(
    text,
    /invalidateQueries\(\{\s*queryKey:\s*projectKeys\.all\s*,\s*exact:\s*true\s*\}\)/,
    "create must invalidate projectKeys.all with exact: true",
  );
  // Must not invalidate byId without exact (would hit nested resources)
  const broadByIdInvalidate =
    /invalidateQueries\(\{\s*queryKey:\s*projectKeys\.byId\([^)]+\)\s*\}\)/.test(text) &&
    !/invalidateQueries\(\{\s*queryKey:\s*projectKeys\.byId\([^)]+\)\s*,\s*exact:\s*true/.test(
      text,
    );
  assert.equal(
    broadByIdInvalidate,
    false,
    "must not invalidate projectKeys.byId without exact: true",
  );
});

test("projects query keys — C4c-3 factory helpers use projectKeys factory only", () => {
  const factoryPath = join(ROOT, CANONICAL_FACTORY);
  const text = readFileSync(factoryPath, "utf8");
  assert.match(text, /function applyProjectStageOptimistic/);
  assert.match(text, /function restoreProjectStageCaches/);
  assert.match(text, /function seedProjectDetailCache/);
  assert.match(text, /projectKeys\.byId/);
  assert.match(text, /projectKeys\.all/);
  assert.equal(
    findRawProjectsListKeys(text, CANONICAL_FACTORY).length,
    0,
    "helpers must not introduce raw list-key literals outside factory all definition",
  );
});
