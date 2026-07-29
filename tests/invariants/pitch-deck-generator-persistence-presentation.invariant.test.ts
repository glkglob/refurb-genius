/**
 * AO-1M2 — PitchDeckGenerator must not own persistence or mutation-oriented QC.
 *
 * Progressive seal: useGenerateAndSavePitchDeck from @/features/export.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment, dynamic import string splits, computed property names.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const COMPONENT = "src/components/pitch-deck/PitchDeckGenerator.tsx";
const HOOK = "src/features/export/presentation/hooks/useGenerateAndSavePitchDeck.ts";

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

test("pitch deck generator — component calls useGenerateAndSavePitchDeck(", () => {
  const text = read(COMPONENT);
  assert.match(
    text,
    /useGenerateAndSavePitchDeck\s*\(/,
    `${COMPONENT} must call useGenerateAndSavePitchDeck(`,
  );
});

test("pitch deck generator — component imports from public feature API", () => {
  const text = read(COMPONENT);
  assert.match(
    text,
    /from\s+["']@\/features\/export["']/,
    `${COMPONENT} must import from @/features/export`,
  );
  assert.doesNotMatch(
    text,
    /presentation\/hooks\/useGenerateAndSavePitchDeck/,
    `${COMPONENT} must not deep-import orchestration hook`,
  );
});

test("pitch deck generator — component bans residual infrastructure ownership", () => {
  const text = read(COMPONENT);
  assert.doesNotMatch(text, /useQueryClient/, `${COMPONENT} must not use useQueryClient`);
  assert.doesNotMatch(text, /useMutation/, `${COMPONENT} must not use useMutation`);
  assert.doesNotMatch(text, /fetchQuery/, `${COMPONENT} must not fetchQuery`);
  assert.doesNotMatch(text, /invalidateQueries/, `${COMPONENT} must not invalidateQueries`);
  assert.doesNotMatch(text, /auth\.getUser/, `${COMPONENT} must not call auth.getUser`);
  assert.doesNotMatch(text, /@\/lib\/auth/, `${COMPONENT} must not import @/lib/auth`);
  assert.doesNotMatch(
    text,
    /savePitchDeckToSupabase/,
    `${COMPONENT} must not call savePitchDeckToSupabase`,
  );
  assert.doesNotMatch(
    text,
    /generatePitchDeckPDF/,
    `${COMPONENT} must not call generatePitchDeckPDF`,
  );
  assert.doesNotMatch(text, /@\/lib\/pitchDeck/, `${COMPONENT} must not import @/lib/pitchDeck`);
  assert.doesNotMatch(
    text,
    /@\/lib\/queries\/pitch-decks/,
    `${COMPONENT} must not import pitch-decks queries`,
  );
  assert.doesNotMatch(
    text,
    /@\/lib\/queries\/projects/,
    `${COMPONENT} must not import projects queries`,
  );
  assert.doesNotMatch(
    text,
    /@\/platform\/supabase/,
    `${COMPONENT} must not import supabase platform`,
  );
  assert.doesNotMatch(
    text,
    /pitch_deck_exports/,
    `${COMPONENT} must not reference pitch_deck_exports`,
  );
  assert.doesNotMatch(text, /storage\.from/, `${COMPONENT} must not use storage.from`);
});

test("pitch deck generator — hook owns orchestration and compose export ports", () => {
  const text = read(HOOK);
  assert.match(text, /legacyPdfExporter/, `${HOOK} must use legacyPdfExporter`);
  assert.match(text, /supabaseExportRepository/, `${HOOK} must use supabaseExportRepository`);
  assert.match(
    text,
    /pitchDecksByProjectQueryOptions/,
    `${HOOK} must use pitchDecksByProjectQueryOptions`,
  );
  assert.match(text, /toast\.success/, `${HOOK} owns success toast`);
  assert.match(text, /toast\.error/, `${HOOK} owns error toast`);
  assert.match(text, /auth\.getUser/, `${HOOK} owns auth gate`);
  assert.doesNotMatch(
    text,
    /from\s+["']@\/lib\/pitchDeck["']/,
    `${HOOK} must not import @/lib/pitchDeck`,
  );
  assert.doesNotMatch(text, /@\/platform\/supabase/, `${HOOK} must not import platform supabase`);
  assert.doesNotMatch(text, /storage\.from/, `${HOOK} must not call storage.from`);
  assert.doesNotMatch(text, /pitch_deck_exports/, `${HOOK} must not reference table directly`);
  assert.doesNotMatch(text, /room-estimate/, `${HOOK} must not use room-estimate`);
});

test("pitch deck generator — probe: residual component QC forbidden", () => {
  const sample = `const qc = useQueryClient();
qc.fetchQuery(projectQueryOptions(id));
qc.invalidateQueries({ queryKey: pitchDecksByProjectQueryOptions(id).queryKey });
`;
  assert.match(sample, /useQueryClient/);
  assert.match(sample, /fetchQuery/);
  assert.match(sample, /invalidateQueries/);
});

test("pitch deck generator — probe: residual savePitchDeckToSupabase in component forbidden", () => {
  const sample = `import { savePitchDeckToSupabase } from "@/lib/pitchDeck";
await savePitchDeckToSupabase(projectId, user.id, blob, filename, pageCount);
`;
  assert.match(sample, /savePitchDeckToSupabase/);
  assert.match(sample, /@\/lib\/pitchDeck/);
});

test("pitch deck generator — probe: canonical composition passes", () => {
  const sample = `
import { useGenerateAndSavePitchDeck } from "@/features/export";
const { generatePitchDeck, isPending, progress, progressStage } = useGenerateAndSavePitchDeck({
  projectId,
  project,
});
`;
  assert.match(sample, /useGenerateAndSavePitchDeck\s*\(/);
  assert.match(sample, /from\s+["']@\/features\/export["']/);
  assert.doesNotMatch(sample, /useQueryClient/);
  assert.doesNotMatch(sample, /savePitchDeckToSupabase/);
});
