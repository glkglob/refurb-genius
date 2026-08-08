/**
 * AO-1M4 — Project workflow routes must not own stage mutation infrastructure.
 *
 * Progressive seal: useSetProjectStage from @/features/projects.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment, dynamic import string splits, computed property names.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

/** Routes that still own browser stage mutation via useSetProjectStage. */
const STAGE_MUTATION_ROUTES = [
  "src/routes/_authed/projects.$id.upload.tsx",
  "src/routes/_authed/projects.$id.analysis.tsx",
] as const;

/**
 * Estimate route (Ticket 4C2B):
 * - canonical category save sets projects.estimate_done via private RPC only
 * - draft manual/AI saves must not mark estimate complete
 * So this route must not call useSetProjectStage for estimate.
 */
const ESTIMATE_ROUTE = "src/routes/_authed/projects.$id.estimate.tsx";

/**
 * IA-5 Export/report route:
 * - Export Complete requires durable snapshot bound to current Estimate
 * - page visit must NOT set report_done via useSetProjectStage
 */
const REPORT_ROUTE = "src/routes/_authed/projects.$id.report.tsx";

const ROUTES = [...STAGE_MUTATION_ROUTES, ESTIMATE_ROUTE, REPORT_ROUTE] as const;

const HOOK = "src/features/projects/presentation/hooks/useSetProjectStage.ts";
const REPO = "src/features/projects/infrastructure/projectStageRepository.ts";
const TRANSITIONAL = "src/hooks/useProjects.ts";
const FEATURE_API = "src/features/projects/index.ts";

function stripLineComments(line: string): string {
  const idx = line.indexOf("//");
  if (idx === -1) return line;
  const before = line.slice(0, idx);
  if (before.endsWith(":")) return line;
  return before;
}

function stripAllComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map(stripLineComments)
    .join("\n");
}

function read(rel: string): string {
  const full = join(ROOT, rel);
  assert.ok(existsSync(full), `missing ${rel}`);
  return stripAllComments(readFileSync(full, "utf8"));
}

test("project stage — feature public API exports useSetProjectStage", () => {
  const text = read(FEATURE_API);
  assert.match(text, /useSetProjectStage/, "feature root must export useSetProjectStage");
  assert.doesNotMatch(
    text,
    /projectStageRepository|setProjectStageDone/,
    "feature root must not export repository",
  );
});

test("project stage — transitional useProjects no longer defines useSetProjectStage", () => {
  const text = read(TRANSITIONAL);
  assert.doesNotMatch(
    text,
    /function useSetProjectStage/,
    `${TRANSITIONAL} must not define useSetProjectStage`,
  );
  assert.doesNotMatch(
    text,
    /@\/platform\/supabase/,
    `${TRANSITIONAL} must not import platform supabase after stage extraction`,
  );
});

for (const route of STAGE_MUTATION_ROUTES) {
  test(`project stage — ${route} calls useSetProjectStage(`, () => {
    const text = read(route);
    assert.match(text, /useSetProjectStage\s*\(/, `${route} must call useSetProjectStage(`);
  });

  test(`project stage — ${route} imports from @/features/projects`, () => {
    const text = read(route);
    assert.match(
      text,
      /useSetProjectStage[^;]*from\s+["']@\/features\/projects["']/,
      `${route} must import useSetProjectStage from @/features/projects`,
    );
    assert.doesNotMatch(
      text,
      /useSetProjectStage[^;]*from\s+["']@\/hooks\/useProjects["']/,
      `${route} must not import useSetProjectStage from @/hooks/useProjects`,
    );
    assert.doesNotMatch(
      text,
      /presentation\/hooks\/useSetProjectStage/,
      `${route} must not deep-import presentation hook`,
    );
  });
}

test("project stage — estimate route does not call useSetProjectStage (4C2B RPC owns estimate_done)", () => {
  const text = read(ESTIMATE_ROUTE);
  assert.doesNotMatch(
    text,
    /useSetProjectStage/,
    `${ESTIMATE_ROUTE} must not use useSetProjectStage; canonical path uses private RPC`,
  );
  assert.doesNotMatch(
    text,
    /stage:\s*["']estimate["']/,
    `${ESTIMATE_ROUTE} must not mark estimate stage from the browser`,
  );
});

test("project stage — report route does not call useSetProjectStage (IA-5 snapshot owns Export)", () => {
  const text = read(REPORT_ROUTE);
  assert.doesNotMatch(
    text,
    /useSetProjectStage/,
    `${REPORT_ROUTE} must not use useSetProjectStage; Export Complete is snapshot-bound`,
  );
  assert.doesNotMatch(
    text,
    /stage:\s*["']report["']/,
    `${REPORT_ROUTE} must not mark report stage from the browser`,
  );
  assert.match(text, /saveExportSnapshot/, `${REPORT_ROUTE} must persist export snapshots`);
});

for (const route of ROUTES) {
  test(`project stage — ${route} bans residual stage mutation infrastructure`, () => {
    const text = read(route);
    // Routes may still use useQueryClient for unrelated prefetch (index does);
    // stage routes should not own mutation infrastructure for stage writes.
    assert.doesNotMatch(text, /useMutation/, `${route} must not use useMutation`);
    assert.doesNotMatch(text, /setQueryData/, `${route} must not setQueryData`);
    assert.doesNotMatch(text, /cancelQueries/, `${route} must not cancelQueries`);
    assert.doesNotMatch(
      text,
      /applyProjectStageOptimistic|restoreProjectStageCaches/,
      `${route} must not own stage cache helpers`,
    );
    assert.doesNotMatch(
      text,
      /from\s*\(\s*["']projects["']\s*\)/,
      `${route} must not call from("projects")`,
    );
    assert.doesNotMatch(
      text,
      /@\/platform\/supabase/,
      `${route} must not import platform supabase`,
    );
    assert.doesNotMatch(
      text,
      /projectStageRepository/,
      `${route} must not import projectStageRepository`,
    );
  });
}

test("project stage — hook owns cache helpers and repository composition", () => {
  const text = read(HOOK);
  assert.match(text, /useMutation/, "hook must use useMutation");
  assert.match(text, /useQueryClient/, "hook must use useQueryClient");
  assert.match(text, /projectKeys\.all/, "hook must use projectKeys.all");
  assert.match(text, /projectKeys\.byId/, "hook must use projectKeys.byId");
  assert.match(text, /applyProjectStageOptimistic/, "hook must use applyProjectStageOptimistic");
  assert.match(text, /restoreProjectStageCaches/, "hook must use restoreProjectStageCaches");
  assert.match(
    text,
    /projectStageRepository\.setProjectStageDone|setProjectStageDone/,
    "hook must call repository setProjectStageDone",
  );
  assert.doesNotMatch(text, /@\/platform\/supabase/, "hook must not import platform supabase");
  assert.doesNotMatch(text, /from\s*\(\s*["']projects["']\s*\)/, "hook must not from(projects)");
  assert.doesNotMatch(text, /\.update\s*\(/, "hook must not call .update(");
  assert.doesNotMatch(text, /invalidateQueries/, "hook must not invalidateQueries");
  assert.doesNotMatch(text, /toast\./, "hook must not toast");
  assert.doesNotMatch(text, /logger\./, "hook must not logger");
  assert.doesNotMatch(text, /auth\.getUser/, "hook must not call auth.getUser");
});

test("project stage — repository owns projects update contract", () => {
  const text = read(REPO);
  assert.match(text, /from\s*\(\s*["']projects["']\s*\)/, "repository must from(projects)");
  assert.match(text, /\.update\s*\(/, "repository must update");
  assert.match(text, /\.eq\s*\(\s*["']id["']/, "repository must filter eq id");
  assert.match(text, /photos_done/, "repository must map photos_done");
  assert.match(text, /analysis_done/, "repository must map analysis_done");
  assert.match(text, /estimate_done/, "repository must map estimate_done");
  assert.match(text, /report_done/, "repository must map report_done");
  assert.doesNotMatch(text, /\.select\s*\(/, "repository must not select");
  assert.doesNotMatch(text, /useMutation|useQueryClient|QueryClient/, "repository has no RQ");
  assert.doesNotMatch(text, /toast\.|logger\./, "repository has no toast/logger");
});

test("project stage — probe: transitional setStage import forbidden", () => {
  const sample = `import { useSetProjectStage } from "@/hooks/useProjects";`;
  assert.match(sample, /@\/hooks\/useProjects/);
  assert.doesNotMatch(sample, /@\/features\/projects/);
});

test("project stage — probe: canonical composition passes", () => {
  const sample = `
import { useSetProjectStage } from "@/features/projects";
const setStage = useSetProjectStage();
setStage.mutate({ id, stage: "photos", value: true });
`;
  assert.match(sample, /useSetProjectStage\s*\(/);
  assert.match(sample, /@\/features\/projects/);
  assert.doesNotMatch(sample, /@\/hooks\/useProjects/);
});
