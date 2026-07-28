/**
 * AO-1H1 — FloorplanViewer must not own Auth, table writes, Storage mutation
 * orchestration, persistence useMutation, or floorplan-key invalidations.
 *
 * Progressive seal for Auth + persistence mutations extraction.
 * Estimate tag sync (syncTagsToEstimate) intentionally remains in the component
 * until AO-1H2 — therefore useQueryClient / getQueryData / setQueryData /
 * invalidateQueries / estimateQueryOptions remain allowed when not tied to
 * floorplanKeys or table writes.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment, dynamic import string splits, computed property names.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const COMPONENT = "src/components/floorplan/FloorplanViewer.tsx";
const HOOK = "src/features/floorplan/presentation/hooks/useFloorplanViewerMutations.ts";
const WRITE = "src/features/floorplan/infrastructure/floorplanWrite.ts";
const FEATURE_INDEX = "src/features/floorplan/index.ts";

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

test("floorplan viewer persistence — component calls useFloorplanViewerMutations(", () => {
  const text = read(COMPONENT);
  assert.match(
    text,
    /useFloorplanViewerMutations\s*\(/,
    `${COMPONENT} must call useFloorplanViewerMutations(`,
  );
  assert.match(
    text,
    /@\/features\/floorplan/,
    `${COMPONENT} must import from @/features/floorplan`,
  );
});

test("floorplan viewer persistence — component bans Auth, Supabase, useMutation, Storage orchestration", () => {
  const text = read(COMPONENT);

  assert.doesNotMatch(text, /auth\.getUser\s*\(/, `${COMPONENT} must not call auth.getUser(`);
  assert.doesNotMatch(text, /@\/lib\/auth/, `${COMPONENT} must not import @/lib/auth`);
  assert.doesNotMatch(
    text,
    /@\/platform\/supabase/,
    `${COMPONENT} must not import platform supabase`,
  );
  assert.doesNotMatch(text, /useMutation/, `${COMPONENT} must not use useMutation`);
  assert.doesNotMatch(
    text,
    /uploadFloorplanModel/,
    `${COMPONENT} must not call uploadFloorplanModel`,
  );
  assert.doesNotMatch(
    text,
    /deleteFloorplanStorage/,
    `${COMPONENT} must not call deleteFloorplanStorage`,
  );
  assert.doesNotMatch(text, /@\/lib\/logger/, `${COMPONENT} must not import logger for upload`);
});

test("floorplan viewer persistence — component bans direct floorplan table writes", () => {
  const text = read(COMPONENT);

  assert.doesNotMatch(
    text,
    /\.from\s*\(\s*["']floorplan_models["']\s*\)/,
    `${COMPONENT} must not .from("floorplan_models")`,
  );
  assert.doesNotMatch(
    text,
    /\.from\s*\(\s*["']floorplan_annotations["']\s*\)/,
    `${COMPONENT} must not .from("floorplan_annotations")`,
  );
  assert.doesNotMatch(
    text,
    /\.from\s*\(\s*["']floorplan_measurements["']\s*\)/,
    `${COMPONENT} must not .from("floorplan_measurements")`,
  );
  assert.doesNotMatch(
    text,
    /createFloorplanModelRecord|deleteFloorplanModelRecord|createFloorplanAnnotation|deleteFloorplanAnnotation|createFloorplanMeasurement|deleteFloorplanMeasurement/,
    `${COMPONENT} must not call write primitives directly`,
  );
});

test("floorplan viewer persistence — component bans floorplanKeys invalidation ownership", () => {
  const text = read(COMPONENT);

  assert.doesNotMatch(text, /floorplanKeys/, `${COMPONENT} must not reference floorplanKeys`);
  assert.doesNotMatch(
    text,
    /floorplanKeys\.byProject|annotationsByModel|measurementsByModel/,
    `${COMPONENT} must not own floorplan key invalidations`,
  );
});

test("floorplan viewer persistence — estimate read and floorplan reads remain allowed", () => {
  const text = read(COMPONENT);

  // Estimate tag-sync cache mutation extracted under AO-1H2 (useSyncFloorplanTagsToEstimate).
  assert.match(
    text,
    /useSyncFloorplanTagsToEstimate|syncTagsToEstimate/,
    `${COMPONENT} retains estimate tag sync via canonical hook or call site`,
  );
  assert.match(
    text,
    /estimateQueryOptions/,
    `${COMPONENT} may use estimateQueryOptions for estimate reads`,
  );
  assert.match(
    text,
    /floorplansByProjectQueryOptions|floorplanAnnotationsQueryOptions|floorplanMeasurementsQueryOptions/,
    `${COMPONENT} retains floorplan read query factories`,
  );
});

test("floorplan viewer persistence — canonical hook owns Auth, mutations, Storage, floorplan keys, toasts", () => {
  const text = read(HOOK);

  assert.match(text, /useMutation/, `${HOOK} must use useMutation`);
  assert.match(text, /useQueryClient/, `${HOOK} must use useQueryClient`);
  assert.match(text, /auth\.getUser/, `${HOOK} must call auth.getUser`);
  assert.match(text, /uploadFloorplanModel/, `${HOOK} orchestrates upload`);
  assert.match(text, /deleteFloorplanStorage/, `${HOOK} orchestrates storage delete`);
  assert.match(text, /createFloorplanModelRecord/, `${HOOK} uses createFloorplanModelRecord`);
  assert.match(text, /deleteFloorplanModelRecord/, `${HOOK} uses deleteFloorplanModelRecord`);
  assert.match(text, /createFloorplanAnnotation/, `${HOOK} uses createFloorplanAnnotation`);
  assert.match(text, /deleteFloorplanAnnotation/, `${HOOK} uses deleteFloorplanAnnotation`);
  assert.match(text, /createFloorplanMeasurement/, `${HOOK} uses createFloorplanMeasurement`);
  assert.match(text, /deleteFloorplanMeasurement/, `${HOOK} uses deleteFloorplanMeasurement`);
  assert.match(text, /floorplanKeys\.byProject/, `${HOOK} invalidates byProject`);
  assert.match(text, /annotationsByModel/, `${HOOK} invalidates annotations`);
  assert.match(text, /measurementsByModel/, `${HOOK} invalidates measurements`);
  assert.match(text, /toast\.success/, `${HOOK} owns success toasts`);
  assert.match(text, /toast\.error/, `${HOOK} owns error toasts`);
  assert.match(text, /toast\.info/, `${HOOK} owns refresh toast`);
  assert.match(text, /logger\.error/, `${HOOK} owns upload error logger`);
  assert.doesNotMatch(text, /estimateQueryOptions/, `${HOOK} must not touch estimate keys`);
  assert.doesNotMatch(text, /room-estimate/, `${HOOK} must not touch room-estimate`);
  assert.doesNotMatch(text, /syncTagsToEstimate/, `${HOOK} must not own estimate sync`);
});

test("floorplan viewer persistence — write module is presentation-free table ops only", () => {
  const text = read(WRITE);

  assert.match(text, /createFloorplanModelRecord/, `${WRITE} exports model create`);
  assert.match(
    text,
    /from\s*\(\s*["']floorplan_models["']\s*\)/,
    `${WRITE} writes floorplan_models`,
  );
  assert.match(
    text,
    /from\s*\(\s*["']floorplan_annotations["']\s*\)/,
    `${WRITE} writes floorplan_annotations`,
  );
  assert.match(
    text,
    /from\s*\(\s*["']floorplan_measurements["']\s*\)/,
    `${WRITE} writes floorplan_measurements`,
  );
  assert.doesNotMatch(
    text,
    /useQueryClient|setQueryData|invalidateQueries|useMutation/,
    `${WRITE} no QueryClient/React mutation`,
  );
  assert.doesNotMatch(
    text,
    /toast|useAuth|auth\.getUser|from ["']react["']/,
    `${WRITE} no toast/Auth/React`,
  );
  assert.doesNotMatch(
    text,
    /uploadFloorplanModel|deleteFloorplanStorage/,
    `${WRITE} no Storage orchestration`,
  );
});

test("floorplan viewer persistence — feature public API exports hook", () => {
  const text = read(FEATURE_INDEX);
  assert.match(text, /useFloorplanViewerMutations/, `${FEATURE_INDEX} exports hook`);
});

test("floorplan viewer persistence — probe: residual useMutation in component is forbidden", () => {
  const sample = `const createModelMutation = useMutation({ mutationFn: async () => {} });
const user = auth.getUser();
await supabase.from("floorplan_models").insert({});
`;
  assert.match(sample, /useMutation/);
  assert.match(sample, /auth\.getUser/);
  assert.match(sample, /floorplan_models/);
});

test("floorplan viewer persistence — probe: string-only hook name does not satisfy call", () => {
  const sample = `const useFloorplanViewerMutations = "fake";`;
  assert.match(sample, /useFloorplanViewerMutations/);
  assert.doesNotMatch(sample, /useFloorplanViewerMutations\s*\(/);
});
