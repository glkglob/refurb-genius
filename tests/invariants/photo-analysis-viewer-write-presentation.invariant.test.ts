/**
 * AO-1C1 — PhotoAnalysisViewer must not own photo_analysis_results write infrastructure.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment of a Supabase client imported under another name, dynamic
 * import strings split across concatenations.
 *
 * Allows residual useQueryClient for Apply-to-Estimate client cache work.
 * Does not ban all photo-analysis infrastructure app-wide.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const VIEWER = "src/components/photos/PhotoAnalysisViewer.tsx";
const WRITE_MODULE = "src/lib/photo-analysis-write.ts";
const READ_MODULE = "src/lib/queries/photo-analysis.ts";
const HOOK_MODULE = "src/features/ai-upload/presentation/hooks/useUpdatePhotoAnalysisResult.ts";

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

function listTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const ents = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of ents) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFiles(full));
    } else if (
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      files.push(full);
    }
  }
  return files;
}

function relPath(file: string): string {
  return relative(ROOT, file).replace(/\\/g, "/");
}

const FROM_ANALYSIS = /\.from\s*\(\s*["']photo_analysis_results["']\s*\)/;
const UPDATE_AFTER_FROM =
  /\.from\s*\(\s*["']photo_analysis_results["']\s*\)[\s\S]{0,200}\.update\s*\(/;

test("photo analysis viewer write — PhotoAnalysisViewer calls useUpdatePhotoAnalysisResult", () => {
  const full = join(ROOT, VIEWER);
  assert.ok(existsSync(full), `missing ${VIEWER}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(
    text,
    /useUpdatePhotoAnalysisResult/,
    `${VIEWER} must use useUpdatePhotoAnalysisResult`,
  );
  assert.match(
    text,
    /useUpdatePhotoAnalysisResult\s*\(/,
    `${VIEWER} must call useUpdatePhotoAnalysisResult(`,
  );
});

test("photo analysis viewer write — PhotoAnalysisViewer bans direct Supabase and write infrastructure", () => {
  const full = join(ROOT, VIEWER);
  const text = stripAllComments(readFileSync(full, "utf8"));

  assert.doesNotMatch(text, /@\/platform\/supabase/, `${VIEWER} must not import platform supabase`);
  assert.doesNotMatch(text, /@\/lib\/supabase/, `${VIEWER} must not import @/lib/supabase`);
  assert.doesNotMatch(text, /@supabase\/supabase-js/, `${VIEWER} must not import supabase-js`);
  assert.doesNotMatch(
    text,
    FROM_ANALYSIS,
    `${VIEWER} must not call .from("photo_analysis_results")`,
  );
  assert.doesNotMatch(text, /useMutation/, `${VIEWER} must not call useMutation`);
  assert.doesNotMatch(
    text,
    /updatePhotoAnalysisResult\s*\(/,
    `${VIEWER} must not call updatePhotoAnalysisResult directly`,
  );
});

test("photo analysis viewer write — PhotoAnalysisViewer retains estimate QueryClient ownership", () => {
  const full = join(ROOT, VIEWER);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /useQueryClient/, `${VIEWER} retains useQueryClient for Apply to Estimate`);
  assert.match(text, /estimateQueryOptions/, `${VIEWER} retains estimateQueryOptions`);
});

test("photo analysis viewer write — canonical hook owns optimistic analysis cache", () => {
  const full = join(ROOT, HOOK_MODULE);
  assert.ok(existsSync(full), `missing ${HOOK_MODULE}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(
    text,
    /updatePhotoAnalysisResult/,
    `${HOOK_MODULE} must call updatePhotoAnalysisResult`,
  );
  assert.match(
    text,
    /photoAnalysisByProjectQueryOptions/,
    `${HOOK_MODULE} must use analysis query options`,
  );
  assert.match(text, /cancelQueries/, `${HOOK_MODULE} must cancelQueries`);
  assert.match(text, /setQueryData/, `${HOOK_MODULE} must setQueryData optimistically`);
  assert.match(text, /invalidateQueries/, `${HOOK_MODULE} must invalidateQueries`);
  assert.match(text, /retry:\s*false/, `${HOOK_MODULE} must set retry: false`);
  assert.doesNotMatch(
    text,
    /@\/platform\/supabase/,
    `${HOOK_MODULE} must not import platform supabase`,
  );
  assert.doesNotMatch(text, /toast/, `${HOOK_MODULE} must not own toasts`);
  assert.doesNotMatch(text, /estimateQueryOptions/, `${HOOK_MODULE} must not touch estimate keys`);
});

test("photo analysis viewer write — production update authority limited to write module", () => {
  const writeFull = join(ROOT, WRITE_MODULE);
  assert.ok(existsSync(writeFull), `missing ${WRITE_MODULE}`);
  const writeText = stripAllComments(readFileSync(writeFull, "utf8"));
  assert.match(writeText, FROM_ANALYSIS, `${WRITE_MODULE} must target photo_analysis_results`);
  assert.match(writeText, /\.update\s*\(/, `${WRITE_MODULE} must call .update`);
  assert.doesNotMatch(writeText, /\.select\s*\(/, `${WRITE_MODULE} must not .select`);
  assert.doesNotMatch(
    writeText,
    /useQueryClient|toast|auth\.getUser/,
    `${WRITE_MODULE} must stay pure`,
  );

  const srcRoot = join(ROOT, "src");
  const offenders: string[] = [];
  for (const file of listTsFiles(srcRoot)) {
    const rel = relPath(file);
    if (rel === WRITE_MODULE) continue;
    if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
    const text = stripAllComments(readFileSync(file, "utf8"));
    if (UPDATE_AFTER_FROM.test(text) || (FROM_ANALYSIS.test(text) && /\.update\s*\(/.test(text))) {
      // Allow only if update is not on this table chain — require from+update proximity
      if (UPDATE_AFTER_FROM.test(text)) {
        offenders.push(rel);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `production photo_analysis_results update must live only in ${WRITE_MODULE}; found: ${offenders.join(", ")}`,
  );
});

test("photo analysis viewer write — read authority remains query module", () => {
  const full = join(ROOT, READ_MODULE);
  assert.ok(existsSync(full), `missing ${READ_MODULE}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, FROM_ANALYSIS, `${READ_MODULE} remains read authority`);
  assert.match(
    text,
    /photoAnalysisByProjectQueryOptions/,
    `${READ_MODULE} exports project query options`,
  );
  assert.doesNotMatch(text, /\.update\s*\(/, `${READ_MODULE} must not update`);
});

test("photo analysis viewer write — probe: direct update in viewer is forbidden", () => {
  const sample = `import { supabase } from "@/platform/supabase/browser";
await supabase.from("photo_analysis_results").update({ category: "x" }).eq("id", id);
`;
  assert.match(sample, FROM_ANALYSIS);
  assert.match(sample, UPDATE_AFTER_FROM);
});

test("photo analysis viewer write — probe: string-only hook name does not satisfy call", () => {
  const sample = `const useUpdatePhotoAnalysisResult = "fake";`;
  assert.match(sample, /useUpdatePhotoAnalysisResult/);
  assert.doesNotMatch(sample, /useUpdatePhotoAnalysisResult\s*\(/);
});

test("photo analysis viewer write — probe: useQueryClient for estimate remains allowed pattern", () => {
  const sample = `const queryClient = useQueryClient();
queryClient.setQueryData(estimateQueryOptions(projectId).queryKey, data);
`;
  assert.match(sample, /useQueryClient/);
  assert.match(sample, /estimateQueryOptions/);
  assert.doesNotMatch(sample, FROM_ANALYSIS);
});
