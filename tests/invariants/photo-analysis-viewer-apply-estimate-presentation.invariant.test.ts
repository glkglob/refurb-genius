/**
 * AO-1C2 — PhotoAnalysisViewer must not own estimate Apply-to-Estimate cache infrastructure.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment, dynamic import string splits.
 *
 * Bans residual useQueryClient / estimateQueryOptions / setQueryData / invalidateQueries
 * in PhotoAnalysisViewer. Requires useApplyPhotoAnalysesToEstimate.
 * Does not ban analysis edit hook (AO-1C1) or claim all estimate infrastructure migrated.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const VIEWER = "src/components/photos/PhotoAnalysisViewer.tsx";
const HOOK = "src/features/estimate/presentation/hooks/useApplyPhotoAnalysesToEstimate.ts";
const MAPPER = "src/features/estimate/application/mapPhotoAnalysesToEstimateRooms.ts";

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

test("photo analysis apply estimate — PhotoAnalysisViewer calls useApplyPhotoAnalysesToEstimate", () => {
  const full = join(ROOT, VIEWER);
  assert.ok(existsSync(full), `missing ${VIEWER}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(
    text,
    /useApplyPhotoAnalysesToEstimate\s*\(/,
    `${VIEWER} must call useApplyPhotoAnalysesToEstimate(`,
  );
});

test("photo analysis apply estimate — PhotoAnalysisViewer bans QueryClient and estimate cache ops", () => {
  const full = join(ROOT, VIEWER);
  const text = stripAllComments(readFileSync(full, "utf8"));

  assert.doesNotMatch(text, /useQueryClient/, `${VIEWER} must not use useQueryClient`);
  assert.doesNotMatch(text, /estimateQueryOptions/, `${VIEWER} must not use estimateQueryOptions`);
  assert.doesNotMatch(text, /setQueryData/, `${VIEWER} must not call setQueryData`);
  assert.doesNotMatch(text, /invalidateQueries/, `${VIEWER} must not call invalidateQueries`);
  assert.doesNotMatch(text, /@\/platform\/supabase/, `${VIEWER} must not import platform supabase`);
  assert.doesNotMatch(text, /useMutation/, `${VIEWER} must not use useMutation for apply`);
});

test("photo analysis apply estimate — canonical hook owns estimate cache key ops", () => {
  const full = join(ROOT, HOOK);
  assert.ok(existsSync(full), `missing ${HOOK}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /estimateQueryOptions/, `${HOOK} must use estimateQueryOptions`);
  assert.match(text, /setQueryData/, `${HOOK} must setQueryData`);
  assert.match(text, /invalidateQueries/, `${HOOK} must invalidateQueries`);
  assert.match(text, /mapPhotoAnalysesToEstimateRooms/, `${HOOK} must call mapper`);
  assert.doesNotMatch(text, /useMutation/, `${HOOK} must not use useMutation`);
  assert.doesNotMatch(text, /from\s+["']sonner["']/, `${HOOK} must not own toasts`);
  assert.doesNotMatch(text, /@\/platform\/supabase/, `${HOOK} must not import platform supabase`);
  assert.doesNotMatch(text, /\["room-estimate"/, `${HOOK} must not use room-estimate key`);
});

test("photo analysis apply estimate — pure mapper has no QueryClient or Supabase", () => {
  const full = join(ROOT, MAPPER);
  assert.ok(existsSync(full), `missing ${MAPPER}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /mapPhotoAnalysesToEstimateRooms/, `${MAPPER} exports mapper`);
  assert.doesNotMatch(text, /useQueryClient|setQueryData|invalidateQueries/, `${MAPPER} pure`);
  assert.doesNotMatch(text, /@\/platform\/supabase|toast|useAuth|auth\.getUser/, `${MAPPER} pure`);
});

test("photo analysis apply estimate — probe: residual QueryClient in viewer is forbidden", () => {
  const sample = `const queryClient = useQueryClient();
queryClient.setQueryData(estimateQueryOptions(projectId).queryKey, data);
`;
  assert.match(sample, /useQueryClient/);
  assert.match(sample, /estimateQueryOptions/);
  assert.match(sample, /setQueryData/);
});

test("photo analysis apply estimate — probe: string-only hook name does not satisfy call", () => {
  const sample = `const useApplyPhotoAnalysesToEstimate = "fake";`;
  assert.match(sample, /useApplyPhotoAnalysesToEstimate/);
  assert.doesNotMatch(sample, /useApplyPhotoAnalysesToEstimate\s*\(/);
});
