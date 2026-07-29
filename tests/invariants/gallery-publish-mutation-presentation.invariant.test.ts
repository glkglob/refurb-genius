/**
 * AO-1M3 — PublishToGallery must not own gallery upsert mutation infrastructure.
 *
 * Progressive seal: useUpsertGalleryProject from @/features/gallery.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment, dynamic import string splits, computed property names.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const COMPONENT = "src/components/gallery/PublishToGallery.tsx";
const HOOK = "src/features/gallery/presentation/hooks/useUpsertGalleryProject.ts";
const REPO = "src/features/gallery/infrastructure/galleryRepository.ts";
const TRANSITIONAL = "src/hooks/useGallery.ts";

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

test("gallery publish — transitional useGallery hook is deleted", () => {
  assert.equal(
    existsSync(join(ROOT, TRANSITIONAL)),
    false,
    `${TRANSITIONAL} must be deleted after AO-1M3 extraction`,
  );
});

test("gallery publish — component calls useUpsertGalleryProject(", () => {
  const text = read(COMPONENT);
  assert.match(
    text,
    /useUpsertGalleryProject\s*\(/,
    `${COMPONENT} must call useUpsertGalleryProject(`,
  );
});

test("gallery publish — component imports from public feature API", () => {
  const text = read(COMPONENT);
  assert.match(
    text,
    /from\s+["']@\/features\/gallery["']/,
    `${COMPONENT} must import from @/features/gallery`,
  );
  assert.doesNotMatch(
    text,
    /@\/hooks\/useGallery/,
    `${COMPONENT} must not import @/hooks/useGallery`,
  );
  assert.doesNotMatch(
    text,
    /presentation\/hooks\/useUpsertGalleryProject/,
    `${COMPONENT} must not deep-import orchestration hook`,
  );
});

test("gallery publish — component bans residual mutation infrastructure", () => {
  const text = read(COMPONENT);
  assert.doesNotMatch(text, /useQueryClient/, `${COMPONENT} must not use useQueryClient`);
  assert.doesNotMatch(text, /useMutation/, `${COMPONENT} must not use useMutation`);
  assert.doesNotMatch(text, /setQueryData/, `${COMPONENT} must not setQueryData`);
  assert.doesNotMatch(text, /invalidateQueries/, `${COMPONENT} must not invalidateQueries`);
  assert.doesNotMatch(text, /cancelQueries/, `${COMPONENT} must not cancelQueries`);
  assert.doesNotMatch(text, /auth\.getUser/, `${COMPONENT} must not call auth.getUser`);
  assert.doesNotMatch(
    text,
    /public_gallery_projects/,
    `${COMPONENT} must not reference public_gallery_projects`,
  );
  assert.doesNotMatch(text, /\.upsert\s*\(/, `${COMPONENT} must not call upsert`);
  assert.doesNotMatch(
    text,
    /@\/platform\/supabase/,
    `${COMPONENT} must not import platform supabase`,
  );
});

test("gallery publish — component retains cover upload and gallery reads", () => {
  const text = read(COMPONENT);
  assert.match(text, /uploadGalleryCoverImage/, `${COMPONENT} retains cover upload`);
  assert.match(text, /galleryByProjectQueryOptions/, `${COMPONENT} retains gallery read`);
});

test("gallery publish — hook owns auth, cache key and repository composition", () => {
  const text = read(HOOK);
  assert.match(text, /auth\.getUser/, `${HOOK} owns auth gate`);
  assert.match(text, /galleryKeys\.byProject/, `${HOOK} uses galleryKeys.byProject`);
  assert.match(text, /galleryRepository/, `${HOOK} uses galleryRepository`);
  assert.match(text, /upsertGalleryProject/, `${HOOK} calls upsertGalleryProject`);
  assert.match(text, /cancelQueries/, `${HOOK} cancels queries on mutate`);
  assert.match(text, /setQueryData/, `${HOOK} owns optimistic setQueryData`);
  assert.match(text, /invalidateQueries/, `${HOOK} owns settled invalidation`);
  assert.doesNotMatch(
    text,
    /from\s*\(\s*["']public_gallery_projects["']\s*\)/,
    `${HOOK} must not call from(public_gallery_projects)`,
  );
  assert.doesNotMatch(text, /@\/platform\/supabase/, `${HOOK} must not import platform supabase`);
  assert.doesNotMatch(text, /storage\.from/, `${HOOK} must not call storage.from`);
});

test("gallery publish — repository owns table upsert contract", () => {
  const text = read(REPO);
  assert.match(text, /public_gallery_projects/, `${REPO} targets public_gallery_projects`);
  assert.match(text, /\.upsert\s*\(/, `${REPO} performs upsert`);
  assert.match(text, /onConflict:\s*["']project_id["']/, `${REPO} uses onConflict project_id`);
  assert.match(text, /Untitled Project/, `${REPO} defaults title`);
  assert.match(text, /\.select\s*\(\s*["']\*["']\s*\)/, `${REPO} selects *`);
  assert.match(text, /\.single\s*\(/, `${REPO} uses single()`);
});

test("gallery publish — probe: residual transitional import forbidden", () => {
  const sample = `import { useUpsertGalleryProject } from "@/hooks/useGallery";`;
  assert.match(sample, /@\/hooks\/useGallery/);
});

test("gallery publish — probe: canonical composition passes", () => {
  const sample = `
import { useUpsertGalleryProject } from "@/features/gallery";
const upsert = useUpsertGalleryProject(projectId);
`;
  assert.match(sample, /useUpsertGalleryProject\s*\(/);
  assert.match(sample, /from\s+["']@\/features\/gallery["']/);
  assert.doesNotMatch(sample, /@\/hooks\/useGallery/);
  assert.doesNotMatch(sample, /useMutation/);
});
