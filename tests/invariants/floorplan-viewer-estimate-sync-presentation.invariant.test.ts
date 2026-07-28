/**
 * AO-1H2 — FloorplanViewer must not own product-estimate tag-sync cache mutation.
 *
 * Progressive seal for syncTagsToEstimate extraction: useQueryClient,
 * getQueryData/setQueryData/invalidateQueries, and inline sync body.
 *
 * Read useQuery(estimateQueryOptions) remains allowed for tag-dialog linking.
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
const HOOK = "src/features/floorplan/presentation/hooks/useSyncFloorplanTagsToEstimate.ts";
const MAPPER = "src/features/floorplan/application/mapFloorplanAnnotationsToEstimateRooms.ts";
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

test("floorplan estimate sync — component calls useSyncFloorplanTagsToEstimate(", () => {
  const text = read(COMPONENT);
  assert.match(
    text,
    /useSyncFloorplanTagsToEstimate\s*\(/,
    `${COMPONENT} must call useSyncFloorplanTagsToEstimate(`,
  );
  assert.match(
    text,
    /@\/features\/floorplan/,
    `${COMPONENT} must import from @/features/floorplan`,
  );
  assert.match(
    text,
    /syncTagsToEstimate\s*\(\s*annotations\s*\)/,
    `${COMPONENT} must pass annotations to syncTagsToEstimate`,
  );
});

test("floorplan estimate sync — component bans QueryClient mutation ownership", () => {
  const text = read(COMPONENT);

  assert.doesNotMatch(text, /useQueryClient/, `${COMPONENT} must not use useQueryClient`);
  assert.doesNotMatch(text, /getQueryData/, `${COMPONENT} must not call getQueryData`);
  assert.doesNotMatch(text, /setQueryData/, `${COMPONENT} must not call setQueryData`);
  assert.doesNotMatch(text, /invalidateQueries/, `${COMPONENT} must not call invalidateQueries`);
  assert.doesNotMatch(
    text,
    /const\s+syncTagsToEstimate\s*=/,
    `${COMPONENT} must not define inline syncTagsToEstimate`,
  );
  assert.doesNotMatch(text, /\["room-estimate"/, `${COMPONENT} must not use room-estimate key`);
  assert.doesNotMatch(text, /financialsByProject/, `${COMPONENT} must not use financials key`);
  assert.doesNotMatch(text, /saveAIEstimate/, `${COMPONENT} must not call saveAIEstimate`);
});

test("floorplan estimate sync — estimate and floorplan read queries remain allowed", () => {
  const text = read(COMPONENT);
  assert.match(text, /useQuery\s*\(/, `${COMPONENT} retains useQuery reads`);
  assert.match(text, /estimateQueryOptions/, `${COMPONENT} may use estimateQueryOptions for read`);
  assert.match(
    text,
    /floorplansByProjectQueryOptions|floorplanAnnotationsQueryOptions|floorplanMeasurementsQueryOptions/,
    `${COMPONENT} retains floorplan read factories`,
  );
  assert.match(text, /Sync to Estimate/, `${COMPONENT} retains sync button label`);
});

test("floorplan estimate sync — canonical hook owns QC, product key, mapper, toasts", () => {
  const text = read(HOOK);
  assert.match(text, /useQueryClient/, `${HOOK} must use useQueryClient`);
  assert.match(text, /estimateQueryOptions/, `${HOOK} must use estimateQueryOptions`);
  assert.match(text, /getQueryData/, `${HOOK} must getQueryData`);
  assert.match(text, /setQueryData/, `${HOOK} must setQueryData`);
  assert.match(text, /invalidateQueries/, `${HOOK} must invalidateQueries`);
  assert.match(text, /mapFloorplanAnnotationsToEstimateRooms/, `${HOOK} must call mapper`);
  assert.match(text, /toast\.info/, `${HOOK} owns info toast`);
  assert.match(text, /toast\.success/, `${HOOK} owns success toast`);
  assert.match(text, /All tags already in Estimate/, `${HOOK} exact info copy`);
  assert.match(
    text,
    /Synced \$\{newRooms\.length\} room tags from 3D to Estimate Builder/,
    `${HOOK} exact success copy`,
  );
  assert.doesNotMatch(text, /useMutation/, `${HOOK} must not use useMutation`);
  assert.doesNotMatch(text, /\["room-estimate"/, `${HOOK} must not touch room-estimate`);
  assert.doesNotMatch(text, /financialsByProject/, `${HOOK} must not touch financials`);
  assert.doesNotMatch(text, /saveAIEstimate/, `${HOOK} must not persist`);
});

test("floorplan estimate sync — pure mapper has no QueryClient or React", () => {
  const text = read(MAPPER);
  assert.match(text, /mapFloorplanAnnotationsToEstimateRooms/, `${MAPPER} exports mapper`);
  assert.match(text, /extractFloorplanAnnotationLabels/, `${MAPPER} exports label extract`);
  assert.doesNotMatch(
    text,
    /useQueryClient|setQueryData|invalidateQueries|useMutation|toast/,
    `${MAPPER} pure`,
  );
  assert.doesNotMatch(
    text,
    /@\/platform\/supabase|from ["']react["']|saveAIEstimate/,
    `${MAPPER} pure`,
  );
});

test("floorplan estimate sync — feature public API exports hook", () => {
  const text = read(FEATURE_INDEX);
  assert.match(text, /useSyncFloorplanTagsToEstimate/, `${FEATURE_INDEX} exports hook`);
  assert.match(text, /mapFloorplanAnnotationsToEstimateRooms/, `${FEATURE_INDEX} exports mapper`);
});

test("floorplan estimate sync — probe: residual useQueryClient in component is forbidden", () => {
  const sample = `const queryClient = useQueryClient();
queryClient.getQueryData(estimateQueryOptions(projectId).queryKey);
`;
  assert.match(sample, /useQueryClient/);
  assert.match(sample, /getQueryData/);
});

test("floorplan estimate sync — probe: string-only hook name does not satisfy call", () => {
  const sample = `const useSyncFloorplanTagsToEstimate = "fake";`;
  assert.match(sample, /useSyncFloorplanTagsToEstimate/);
  assert.doesNotMatch(sample, /useSyncFloorplanTagsToEstimate\s*\(/);
});
