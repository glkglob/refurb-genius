/**
 * AO-1G1 — EstimateBuilder must not own direct save mutation or QueryClient.
 *
 * Progressive seal for manual estimate save: useMutation, saveAIEstimate,
 * cache seed/optimistic/invalidation, and estimate query factories.
 *
 * PDF toast/logger remain allowed (presentation export path).
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment, dynamic import string splits, computed property names.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const COMPONENT = "src/components/EstimateBuilder.tsx";
const HOOK = "src/features/estimate/presentation/hooks/useSaveEstimateBuilder.ts";
const MAPPER = "src/features/estimate/application/buildEstimateBuilderSaveInput.ts";

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

test("estimate builder save — component calls useSaveEstimateBuilder(", () => {
  const text = read(COMPONENT);
  assert.match(
    text,
    /useSaveEstimateBuilder\s*\(/,
    `${COMPONENT} must call useSaveEstimateBuilder(`,
  );
});

test("estimate builder save — component calls buildEstimateBuilderSaveInput(", () => {
  const text = read(COMPONENT);
  assert.match(
    text,
    /buildEstimateBuilderSaveInput\s*\(/,
    `${COMPONENT} must call buildEstimateBuilderSaveInput(`,
  );
});

test("estimate builder save — component bans residual mutation and QueryClient ownership", () => {
  const text = read(COMPONENT);

  assert.doesNotMatch(text, /useQueryClient/, `${COMPONENT} must not use useQueryClient`);
  assert.doesNotMatch(text, /useMutation/, `${COMPONENT} must not use useMutation`);
  assert.doesNotMatch(text, /saveAIEstimate/, `${COMPONENT} must not call saveAIEstimate`);
  assert.doesNotMatch(text, /setQueryData/, `${COMPONENT} must not call setQueryData`);
  assert.doesNotMatch(text, /getQueryData/, `${COMPONENT} must not call getQueryData`);
  assert.doesNotMatch(text, /invalidateQueries/, `${COMPONENT} must not call invalidateQueries`);
  assert.doesNotMatch(text, /cancelQueries/, `${COMPONENT} must not call cancelQueries`);
  assert.doesNotMatch(
    text,
    /estimateQueryOptions/,
    `${COMPONENT} must not use estimateQueryOptions`,
  );
  assert.doesNotMatch(text, /projectKeys/, `${COMPONENT} must not use projectKeys`);
  assert.doesNotMatch(
    text,
    /@\/lib\/queries\/projects/,
    `${COMPONENT} must not import @/lib/queries/projects`,
  );
  assert.doesNotMatch(text, /\["room-estimate"/, `${COMPONENT} must not use room-estimate key`);
});

test("estimate builder save — PDF toast and logger remain allowed", () => {
  const text = read(COMPONENT);
  assert.match(text, /toast\.(success|error)/, `${COMPONENT} may use toast for PDF export`);
  assert.match(text, /logger\.error/, `${COMPONENT} may log PDF export failures`);
  assert.match(text, /PDF exported|Failed to export PDF/, `${COMPONENT} retains PDF toast copy`);
});

test("estimate builder save — canonical hook owns mutation, QC, saveAIEstimate, product keys", () => {
  const text = read(HOOK);
  assert.match(text, /useMutation/, `${HOOK} must use useMutation`);
  assert.match(text, /useQueryClient/, `${HOOK} must use useQueryClient`);
  assert.match(text, /saveAIEstimate/, `${HOOK} must call saveAIEstimate`);
  assert.match(text, /estimateQueryOptions/, `${HOOK} must use estimateQueryOptions`);
  assert.match(text, /financialsByProject/, `${HOOK} must invalidate financials`);
  assert.match(text, /setQueryData/, `${HOOK} must setQueryData`);
  assert.match(text, /invalidateQueries/, `${HOOK} must invalidateQueries`);
  assert.match(text, /toast\.success/, `${HOOK} owns success toast`);
  assert.match(text, /toast\.error/, `${HOOK} owns error toast`);
  assert.match(text, /estimate-draft/, `${HOOK} clears draft key`);
  assert.doesNotMatch(text, /\["room-estimate"/, `${HOOK} must not use room-estimate key`);
});

test("estimate builder save — pure mapper has no QueryClient, React, or persistence", () => {
  const text = read(MAPPER);
  assert.match(text, /buildEstimateBuilderSaveInput/, `${MAPPER} exports mapper`);
  assert.doesNotMatch(
    text,
    /useQueryClient|setQueryData|invalidateQueries|useMutation/,
    `${MAPPER} pure`,
  );
  assert.doesNotMatch(
    text,
    /@\/platform\/supabase|toast|useAuth|auth\.getUser|from ["']react["']/,
    `${MAPPER} pure`,
  );
  assert.doesNotMatch(text, /saveAIEstimate\s*\(/, `${MAPPER} does not persist`);
});

test("estimate builder save — probe: residual useMutation in component is forbidden", () => {
  const sample = `const saveMutation = useMutation({ mutationFn: saveAIEstimate });
const queryClient = useQueryClient();
`;
  assert.match(sample, /useMutation/);
  assert.match(sample, /saveAIEstimate/);
  assert.match(sample, /useQueryClient/);
});

test("estimate builder save — probe: string-only hook name does not satisfy call", () => {
  const sample = `const useSaveEstimateBuilder = "fake";`;
  assert.match(sample, /useSaveEstimateBuilder/);
  assert.doesNotMatch(sample, /useSaveEstimateBuilder\s*\(/);
});
