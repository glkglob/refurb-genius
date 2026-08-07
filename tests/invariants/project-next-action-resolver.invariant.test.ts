/**
 * IA-2 invariant: single Projects-owned next-action resolver.
 *
 * Protects ownership and actionKind contract without banning ordinary UI conditionals.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function listTs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTs(full));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

test("IA-2 canonical resolver lives under Projects domain", () => {
  const path = "src/features/projects/domain/resolveProjectNextAction.ts";
  assert.equal(existsSync(join(ROOT, path)), true);
  const src = read(path);
  assert.match(src, /export function resolveProjectNextAction/);
  assert.match(src, /reconcile_scope/);
  assert.match(src, /view_stage_progress/);
  assert.match(src, /IA-0 v1\.0\.1/);
  // Purity markers
  assert.doesNotMatch(src, /from ["']@\/platform\//);
  assert.doesNotMatch(src, /from ["']@supabase\//);
  assert.doesNotMatch(src, /from ["']react["']/);
  assert.doesNotMatch(src, /createServerFn/);
});

test("IA-2 public Projects API exports resolveProjectNextAction", () => {
  const src = read("src/features/projects/index.ts");
  assert.match(src, /resolveProjectNextAction/);
  assert.match(src, /ProjectNextActionKind/);
  assert.match(src, /PROJECT_NEXT_ACTION_KINDS/);
});

test("IA-2 action kinds include locked Scope and In-progress contracts", () => {
  const src = read("src/features/projects/domain/nextActionKinds.ts");
  for (const kind of [
    "add_photos",
    "analyse_photos",
    "update_analysis",
    "create_redesign",
    "select_redesign",
    "update_redesign",
    "unlock_redesign",
    "reconcile_scope",
    "build_estimate",
    "update_estimate",
    "create_export",
    "update_export",
    "view_stage_progress",
    "view_completed_project",
  ]) {
    assert.match(src, new RegExp(`"${kind}"`));
  }
});

test("IA-2 does not introduce first-class /redesign route", () => {
  assert.equal(
    existsSync(join(ROOT, "src/routes/_authed/projects.$id.redesign.tsx")),
    false,
    "IA-4 owns /projects/$id/redesign",
  );
});

test("IA-2 — only one resolveProjectNextAction definition under src", () => {
  const defs: string[] = [];
  for (const file of listTs(join(ROOT, "src"))) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (rel.includes(".test.")) continue;
    const text = readFileSync(file, "utf8");
    if (/export\s+function\s+resolveProjectNextAction\b/.test(text)) {
      defs.push(rel);
    }
  }
  assert.deepEqual(
    defs,
    ["src/features/projects/domain/resolveProjectNextAction.ts"],
    `exactly one resolveProjectNextAction owner expected, found:\n${defs.join("\n")}`,
  );
});

test("IA-2 — presentation shell does not own next-action resolution", () => {
  const shell = read("src/features/projects/presentation/components/ProjectWorkflowShell.tsx");
  const nav = read("src/features/projects/presentation/components/ProjectStageNav.tsx");
  assert.doesNotMatch(shell, /resolveProjectNextAction/);
  assert.doesNotMatch(nav, /resolveProjectNextAction/);
  // Legacy Overview continuation remains until IA-6 (documented, not migrated here).
  const overview = read("src/routes/_authed/projects.$id.index.tsx");
  assert.match(overview, /no IA-2 resolver|first incomplete|nextStagePresentation/i);
});
