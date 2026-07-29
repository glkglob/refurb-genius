/**
 * AO-1L1 — AIEstimateBuilder must not own save mutation orchestration.
 *
 * Progressive seal: builder save hook + pure mapper; compose useSaveAIEstimate.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment, dynamic import string splits, computed property names.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const COMPONENT = "src/components/AIEstimateBuilder.tsx";
const HOOK = "src/features/estimate/presentation/hooks/useAIEstimateBuilderSave.ts";
const MAPPER = "src/features/estimate/application/buildAIEstimateBuilderSaveInput.ts";

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

test("ai estimate builder save — component calls useAIEstimateBuilderSave(", () => {
  const text = read(COMPONENT);
  assert.match(
    text,
    /useAIEstimateBuilderSave\s*\(/,
    `${COMPONENT} must call useAIEstimateBuilderSave(`,
  );
});

test("ai estimate builder save — component imports from public feature API", () => {
  const text = read(COMPONENT);
  assert.match(
    text,
    /from\s+["']@\/features\/estimate["']/,
    `${COMPONENT} must import from @/features/estimate`,
  );
  assert.doesNotMatch(
    text,
    /presentation\/hooks\/useAIEstimateBuilderSave/,
    `${COMPONENT} must not deep-import save hook`,
  );
});

test("ai estimate builder save — generation remains allowed", () => {
  const text = read(COMPONENT);
  assert.match(text, /useGenerateEstimate/, `${COMPONENT} may use useGenerateEstimate`);
});

test("ai estimate builder save — component bans residual save ownership", () => {
  const text = read(COMPONENT);
  assert.doesNotMatch(text, /useQueryClient/, `${COMPONENT} must not use useQueryClient`);
  assert.doesNotMatch(text, /useMutation/, `${COMPONENT} must not use useMutation`);
  assert.doesNotMatch(text, /useSaveAIEstimate/, `${COMPONENT} must not call useSaveAIEstimate`);
  assert.doesNotMatch(text, /saveAIEstimate/, `${COMPONENT} must not import saveAIEstimate`);
  assert.doesNotMatch(text, /invalidateQueries/, `${COMPONENT} must not invalidateQueries`);
  assert.doesNotMatch(text, /setQueryData/, `${COMPONENT} must not setQueryData`);
  assert.doesNotMatch(text, /getQueryData/, `${COMPONENT} must not getQueryData`);
  assert.doesNotMatch(text, /cancelQueries/, `${COMPONENT} must not cancelQueries`);
  assert.doesNotMatch(text, /vat_rate\s*:\s*20/, `${COMPONENT} must not construct vat_rate: 20`);
  assert.doesNotMatch(
    text,
    /AI Estimate —/,
    `${COMPONENT} must not construct AI Estimate title template`,
  );
  // generate.mutate remains allowed; direct save mutation ownership is banned above.
});

test("ai estimate builder save — canonical hook owns orchestration", () => {
  const text = read(HOOK);
  assert.match(text, /useSaveAIEstimate/, `${HOOK} must compose useSaveAIEstimate`);
  assert.match(
    text,
    /buildAIEstimateBuilderSaveInput/,
    `${HOOK} must use buildAIEstimateBuilderSaveInput`,
  );
  assert.match(text, /toast\.success/, `${HOOK} owns success toast`);
  assert.match(text, /toast\.error/, `${HOOK} owns error toast`);
  assert.doesNotMatch(text, /useQueryClient/, `${HOOK} must not use useQueryClient`);
  assert.doesNotMatch(text, /useMutation/, `${HOOK} must not use useMutation`);
  assert.doesNotMatch(text, /invalidateQueries/, `${HOOK} must not invalidateQueries`);
  assert.doesNotMatch(text, /projectKeys/, `${HOOK} must not use projectKeys`);
  assert.doesNotMatch(text, /room-estimate/, `${HOOK} must not use room-estimate`);
  assert.doesNotMatch(text, /saveAIEstimate/, `${HOOK} must not import saveAIEstimate`);
});

test("ai estimate builder save — pure mapper has no React or persistence", () => {
  const text = read(MAPPER);
  assert.match(text, /buildAIEstimateBuilderSaveInput/, `${MAPPER} exports mapper`);
  assert.match(text, /calculateLineItem/, `${MAPPER} may use calculateLineItem`);
  assert.doesNotMatch(text, /useQueryClient|useMutation|invalidateQueries|toast/, `${MAPPER} pure`);
  assert.doesNotMatch(text, /@\/platform\/supabase|useAuth|from ["']react["']/, `${MAPPER} pure`);
  assert.doesNotMatch(text, /saveAIEstimate\s*\(/, `${MAPPER} does not persist`);
});

test("ai estimate builder save — probe: residual useSaveAIEstimate in component forbidden", () => {
  const sample = `const save = useSaveAIEstimate();
save.mutate({ projectId, vat_rate: 20 });
`;
  assert.match(sample, /useSaveAIEstimate/);
  assert.match(sample, /vat_rate\s*:\s*20/);
  assert.match(sample, /\.mutate\s*\(/);
});

test("ai estimate builder save — probe: QueryClient in hook forbidden", () => {
  const sample = `const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: projectKeys.estimateByProject(id) });
`;
  assert.match(sample, /useQueryClient/);
  assert.match(sample, /invalidateQueries/);
  assert.match(sample, /projectKeys/);
});

test("ai estimate builder save — probe: canonical composition passes", () => {
  const sample = `
import { useGenerateEstimate, useAIEstimateBuilderSave } from "@/features/estimate";
const { saveEstimate, isPending } = useAIEstimateBuilderSave({ projectId, onSaved });
saveEstimate({ propertyType, bedrooms, region, rooms, notes, multiplier, totals });
`;
  assert.match(sample, /useAIEstimateBuilderSave\s*\(/);
  assert.match(sample, /from\s+["']@\/features\/estimate["']/);
  assert.doesNotMatch(sample, /useSaveAIEstimate/);
  assert.doesNotMatch(sample, /useQueryClient/);
});
