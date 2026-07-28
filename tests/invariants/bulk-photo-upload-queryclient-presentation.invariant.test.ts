/**
 * AO-1I1 — BulkPhotoUpload must not own QueryClient photo-list invalidation.
 *
 * Progressive seal for residual invalidateQueries extraction:
 * useQueryClient, invalidateQueries, and projectKeys.photosByProject ownership
 * move to useInvalidateProjectPhotos from @/features/ai-upload.
 *
 * Write authority remains uploadProjectPhotos (C5 seal; unchanged).
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment, wrapper functions, dynamic import string splits, computed
 * property names.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const COMPONENT = "src/components/BulkPhotoUpload.tsx";
const HOOK = "src/features/ai-upload/presentation/hooks/useInvalidateProjectPhotos.ts";
const FEATURE_PRESENTATION = "src/features/ai-upload/presentation/index.ts";
const FEATURE_INDEX = "src/features/ai-upload/index.ts";

function stripLineComments(line: string): string {
  const idx = line.indexOf("//");
  if (idx === -1) return line;
  const before = line.slice(0, idx);
  if (before.endsWith(":")) return line;
  return before;
}

function stripBlockComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "");
}

function readSource(rel: string): string {
  const path = join(ROOT, rel);
  assert.ok(existsSync(path), `${rel} must exist`);
  const raw = readFileSync(path, "utf8");
  return stripBlockComments(raw).split("\n").map(stripLineComments).join("\n");
}

test("bulk photo QC — component calls useInvalidateProjectPhotos(", () => {
  const text = readSource(COMPONENT);
  assert.match(
    text,
    /useInvalidateProjectPhotos\s*\(/,
    `${COMPONENT} must call useInvalidateProjectPhotos(`,
  );
});

test("bulk photo QC — component imports from @/features/ai-upload public barrel", () => {
  const text = readSource(COMPONENT);
  assert.match(
    text,
    /from\s+["']@\/features\/ai-upload["']/,
    `${COMPONENT} must import from @/features/ai-upload`,
  );
  assert.doesNotMatch(
    text,
    /from\s+["']@\/features\/ai-upload\/presentation\/hooks\/useInvalidateProjectPhotos["']/,
    `${COMPONENT} must not deep-import the invalidation hook`,
  );
});

test("bulk photo QC — component bans QueryClient and cache mutation ownership", () => {
  const text = readSource(COMPONENT);
  assert.doesNotMatch(text, /useQueryClient/, `${COMPONENT} must not use useQueryClient`);
  assert.doesNotMatch(text, /invalidateQueries/, `${COMPONENT} must not call invalidateQueries`);
  assert.doesNotMatch(text, /getQueryData/, `${COMPONENT} must not call getQueryData`);
  assert.doesNotMatch(text, /setQueryData/, `${COMPONENT} must not call setQueryData`);
  assert.doesNotMatch(text, /cancelQueries/, `${COMPONENT} must not call cancelQueries`);
  assert.doesNotMatch(text, /removeQueries/, `${COMPONENT} must not call removeQueries`);
  assert.doesNotMatch(text, /resetQueries/, `${COMPONENT} must not call resetQueries`);
  assert.doesNotMatch(
    text,
    /projectKeys\.photosByProject/,
    `${COMPONENT} must not own projectKeys.photosByProject`,
  );
  assert.doesNotMatch(
    text,
    /\[["']projects["']\s*,/,
    `${COMPONENT} must not use raw projects key literals`,
  );
  assert.doesNotMatch(
    text,
    /from\s+["']@\/lib\/queries\/projects["']/,
    `${COMPONENT} must not import @/lib/queries/projects`,
  );
});

test("bulk photo QC — write primitive and UI remain allowed", () => {
  const text = readSource(COMPONENT);
  assert.match(text, /uploadProjectPhotos\s*\(/, `${COMPONENT} must call uploadProjectPhotos(`);
  assert.match(
    text,
    /from\s+["']@\/lib\/photos-write["']/,
    `${COMPONENT} must import from @/lib/photos-write`,
  );
  assert.match(text, /isImageFile/, `${COMPONENT} may use isImageFile`);
  assert.match(text, /toast\./, `${COMPONENT} may use toasts`);
});

test("bulk photo QC — canonical hook owns QC and photosByProject invalidation", () => {
  const text = readSource(HOOK);
  assert.match(text, /useQueryClient/, `${HOOK} must use useQueryClient`);
  assert.match(text, /invalidateQueries/, `${HOOK} must invalidateQueries`);
  assert.match(text, /projectKeys\.photosByProject/, `${HOOK} must use photosByProject`);
  assert.match(text, /void\s+/, `${HOOK} must fire-and-forget invalidate (void)`);
  assert.doesNotMatch(text, /getQueryData/, `${HOOK} must not getQueryData`);
  assert.doesNotMatch(text, /setQueryData/, `${HOOK} must not setQueryData`);
  assert.doesNotMatch(text, /cancelQueries/, `${HOOK} must not cancelQueries`);
  assert.doesNotMatch(text, /useMutation/, `${HOOK} must not use useMutation`);
  assert.doesNotMatch(text, /supabase/, `${HOOK} must not use Supabase`);
  assert.doesNotMatch(text, /uploadProjectPhotos/, `${HOOK} must not own upload`);
});

test("bulk photo QC — feature public API exports hook", () => {
  const presentation = readSource(FEATURE_PRESENTATION);
  assert.match(
    presentation,
    /useInvalidateProjectPhotos/,
    `${FEATURE_PRESENTATION} exports useInvalidateProjectPhotos`,
  );
  const root = readSource(FEATURE_INDEX);
  assert.match(root, /presentation/, `${FEATURE_INDEX} re-exports presentation`);
});

test("bulk photo QC — probe: residual useQueryClient in component is forbidden", () => {
  const sample = `const queryClient = useQueryClient();
void queryClient.invalidateQueries({ queryKey: projectKeys.photosByProject(projectId) });`;
  assert.match(sample, /useQueryClient/);
  assert.match(sample, /invalidateQueries/);
  assert.match(sample, /projectKeys\.photosByProject/);
});

test("bulk photo QC — probe: raw photo key literal is forbidden", () => {
  const sample = `void queryClient.invalidateQueries({ queryKey: ["projects", projectId, "photos"] });`;
  assert.match(sample, /\[["']projects["']\s*,/);
});

test("bulk photo QC — probe: deep hook import is forbidden", () => {
  const sample = `import { useInvalidateProjectPhotos } from "@/features/ai-upload/presentation/hooks/useInvalidateProjectPhotos";`;
  assert.match(
    sample,
    /from\s+["']@\/features\/ai-upload\/presentation\/hooks\/useInvalidateProjectPhotos["']/,
  );
});

test("bulk photo QC — probe: string-only hook name does not satisfy call", () => {
  const sample = `const useInvalidateProjectPhotos = "fake";`;
  assert.match(sample, /useInvalidateProjectPhotos/);
  assert.doesNotMatch(sample, /useInvalidateProjectPhotos\s*\(/);
});
