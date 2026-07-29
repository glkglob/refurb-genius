/**
 * AO-1K1 — Estimate presentation hooks must use the product estimate cache authority.
 *
 * Target: src/features/estimate/presentation/hooks/useEstimate.ts
 *
 * Require: estimateQueryOptions, projectKeys.estimateByProject,
 * projectKeys.financialsByProject, import from @/lib/queries/projects.
 *
 * Ban: room-estimate production key, raw product estimate tuples,
 * local duplicate estimate key factories.
 *
 * Strength: progressive lexical seal (comment-stripped source scan).
 * Known bypasses: alias imports, dynamic imports, wrapper functions,
 * computed strings, split literals. Does not claim AST enforcement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const HOOK = "src/features/estimate/presentation/hooks/useEstimate.ts";

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

test("estimate query-key authority — imports canonical factories from projects queries", () => {
  const text = read(HOOK);
  assert.match(
    text,
    /from\s+["']@\/lib\/queries\/projects["']/,
    `${HOOK} must import from @/lib/queries/projects`,
  );
  assert.match(text, /estimateQueryOptions/, `${HOOK} must reference estimateQueryOptions`);
  assert.match(
    text,
    /projectKeys\.estimateByProject/,
    `${HOOK} must reference projectKeys.estimateByProject`,
  );
  assert.match(
    text,
    /projectKeys\.financialsByProject/,
    `${HOOK} must reference projectKeys.financialsByProject`,
  );
});

test("estimate query-key authority — useRoomEstimate uses estimateQueryOptions", () => {
  const text = read(HOOK);
  assert.match(text, /export function useRoomEstimate/, `${HOOK} exports useRoomEstimate`);
  assert.match(
    text,
    /estimateQueryOptions\s*\(/,
    `${HOOK} useRoomEstimate must call estimateQueryOptions(`,
  );
});

test("estimate query-key authority — useSaveAIEstimate invalidates product estimate and financials", () => {
  const text = read(HOOK);
  assert.match(text, /export function useSaveAIEstimate/, `${HOOK} exports useSaveAIEstimate`);
  assert.match(text, /invalidateQueries/, `${HOOK} must invalidateQueries`);
  assert.match(
    text,
    /projectKeys\.estimateByProject/,
    `${HOOK} must invalidate via projectKeys.estimateByProject`,
  );
  assert.match(
    text,
    /projectKeys\.financialsByProject/,
    `${HOOK} must invalidate via projectKeys.financialsByProject`,
  );
  assert.match(text, /saveAIEstimate/, `${HOOK} must call saveAIEstimate`);
});

test("estimate query-key authority — bans retired room-estimate production key", () => {
  const text = read(HOOK);
  assert.doesNotMatch(text, /room-estimate/, `${HOOK} must not reference room-estimate`);
  assert.doesNotMatch(text, /\["room-estimate"/, `${HOOK} must not use ["room-estimate" tuple`);
});

test("estimate query-key authority — bans raw product estimate tuple recreation", () => {
  const text = read(HOOK);
  assert.doesNotMatch(
    text,
    /\["projects"\s*,\s*[^\]]*"estimate"\s*\]/,
    `${HOOK} must not recreate raw ["projects", …, "estimate"] tuples`,
  );
});

test("estimate query-key authority — bans local duplicate estimate key factory", () => {
  const text = read(HOOK);
  assert.doesNotMatch(
    text,
    /const\s+estimateKeys\s*=\s*\{/,
    `${HOOK} must not define local estimateKeys factory`,
  );
});

test("estimate query-key authority — probe: room-estimate queryKey is forbidden", () => {
  const sample = `queryKey: ["room-estimate", projectId]`;
  assert.match(sample, /room-estimate/);
  assert.match(sample, /\["room-estimate"/);
});

test("estimate query-key authority — probe: room-estimate invalidation is forbidden", () => {
  const sample = `queryClient.invalidateQueries({
  queryKey: ["room-estimate", projectId],
});`;
  assert.match(sample, /room-estimate/);
  assert.match(sample, /\["room-estimate"/);
});

test("estimate query-key authority — probe: local room-estimate factory is forbidden", () => {
  const sample = `const estimateKeys = {
  byProject: (id: string) =>
    ["room-estimate", id] as const,
};`;
  assert.match(sample, /const\s+estimateKeys\s*=\s*\{/);
  assert.match(sample, /room-estimate/);
});

test("estimate query-key authority — probe: raw product tuple is forbidden in hook", () => {
  const sample = `queryKey: ["projects", projectId, "estimate"]`;
  assert.match(sample, /\["projects"\s*,\s*[^\]]*"estimate"\s*\]/);
});

test("estimate query-key authority — probe: canonical factories pass", () => {
  const sample = `
import { estimateQueryOptions, projectKeys } from "@/lib/queries/projects";
useQuery({ ...estimateQueryOptions(projectId ?? ""), enabled: !!projectId });
void queryClient.invalidateQueries({ queryKey: projectKeys.estimateByProject(variables.projectId) });
void queryClient.invalidateQueries({ queryKey: projectKeys.financialsByProject(variables.projectId) });
`;
  assert.match(sample, /from\s+["']@\/lib\/queries\/projects["']/);
  assert.match(sample, /estimateQueryOptions\s*\(/);
  assert.match(sample, /projectKeys\.estimateByProject/);
  assert.match(sample, /projectKeys\.financialsByProject/);
  assert.doesNotMatch(sample, /room-estimate/);
  assert.doesNotMatch(sample, /\["projects"\s*,\s*[^\]]*"estimate"\s*\]/);
});
