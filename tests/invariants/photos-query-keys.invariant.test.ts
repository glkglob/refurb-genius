/**
 * C5-1 + C5-2 + C5-3B2 + C5-3B3 — Product-photo list authority + write-path seal.
 *
 * Seals:
 * - projectKeys.photosByProject as the sole product list key family
 * - fetchProjectPhotosList + photosQueryOptions as the named fetch/options authority
 * - usePhotos must call photosQueryOptions(
 * - AI catalog + room-analysis mock source reads use fetchProjectPhotosList (C5-2)
 * - zero production photoStore.list call sites outside the store definition
 * - usePhotos hooks use uploadProjectPhotos / removeProjectPhoto (C5-3B2)
 * - BulkPhotoUpload uses uploadProjectPhotos; no direct Auth/Storage/photos writes (C5-3B3)
 * - active production project-photo write call sites use @/lib/photos-write
 *
 * Does NOT require photoStore retirement or barrel cleanup (C5-4).
 * src/lib/photos.ts may remain as a temporary dormant-definition exception (zero callers).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const CANONICAL_FACTORY = "src/lib/queries/projects.ts";
const USE_PHOTOS_HOOK = "src/features/ai-upload/presentation/hooks/usePhotos.ts";
const BULK_PHOTO_UPLOAD = "src/components/BulkPhotoUpload.tsx";
const PHOTO_CATALOG_REPO =
  "src/features/ai-upload/infrastructure/repositories/photo-catalog.repository.ts";
const ROOM_ANALYSIS_REPO =
  "src/features/ai-upload/infrastructure/repositories/room-analysis.repository.ts";

/**
 * Modules allowed to call supabase.from("photos").
 *
 * - src/lib/photos-write.ts — canonical active writer
 * - src/lib/photos.ts — temporary dormant store definition exception (C5-4 retirement)
 * - queries/projects, gallery, ai-quality-audit — read-only list/audit authority
 *
 * BulkPhotoUpload is intentionally NOT listed after C5-3B3.
 */
const PHOTOS_TABLE_ALLOWLIST = new Set([
  "src/lib/queries/projects.ts",
  "src/lib/photos.ts",
  "src/lib/photos-write.ts",
  "src/lib/queries/gallery.ts",
  "src/lib/ai-quality-audit.ts",
]);

const SCAN_ROOTS = [
  join(ROOT, "src/hooks"),
  join(ROOT, "src/lib"),
  join(ROOT, "src/routes"),
  join(ROOT, "src/features"),
  join(ROOT, "src/components"),
  join(ROOT, "src/core"),
] as const;

function listTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const ents = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of ents) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) continue;
      if (entry.name.endsWith(".spec.ts") || entry.name.endsWith(".spec.tsx")) continue;
      files.push(full);
    }
  }
  return files;
}

function stripLineComments(line: string): string {
  const idx = line.indexOf("//");
  if (idx === -1) return line;
  const before = line.slice(0, idx);
  if (before.endsWith(":")) return line;
  return before;
}

function stripComments(text: string): string {
  return text.split("\n").map(stripLineComments).join("\n");
}

/** Strip block + line comments for write-path probes (avoids doc false positives). */
function stripAllComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map(stripLineComments)
    .join("\n");
}

function relPath(file: string): string {
  return relative(ROOT, file).replace(/\\/g, "/");
}

// ─── Canonical factory ───────────────────────────────────────────────────────

test("photos query keys — factory exports fetchProjectPhotosList and photosQueryOptions", () => {
  const factoryPath = join(ROOT, CANONICAL_FACTORY);
  assert.ok(existsSync(factoryPath), `missing ${CANONICAL_FACTORY}`);
  const text = readFileSync(factoryPath, "utf8");
  assert.match(
    text,
    /export\s+async\s+function\s+fetchProjectPhotosList/,
    "factory must export fetchProjectPhotosList",
  );
  assert.match(
    text,
    /export\s+const\s+photosQueryOptions/,
    "factory must export photosQueryOptions",
  );
  assert.match(text, /photosByProject/, "factory must define projectKeys.photosByProject");
  assert.match(
    text,
    /queryKey:\s*projectKeys\.photosByProject/,
    "photosQueryOptions must use projectKeys.photosByProject",
  );
  assert.match(
    text,
    /queryFn:\s*\(\)\s*=>\s*fetchProjectPhotosList\s*\(/,
    "photosQueryOptions must call fetchProjectPhotosList (not a duplicate inline fetch)",
  );
  assert.match(
    text,
    /order\s*\(\s*["']uploaded_at["']\s*,\s*\{\s*ascending:\s*true\s*\}\s*\)/,
    "fetchProjectPhotosList must order by uploaded_at ascending",
  );
});

// ─── usePhotos ───────────────────────────────────────────────────────────────

test("photos query keys — usePhotos calls photosQueryOptions()", () => {
  const hookPath = join(ROOT, USE_PHOTOS_HOOK);
  assert.ok(existsSync(hookPath), `missing ${USE_PHOTOS_HOOK}`);
  const text = readFileSync(hookPath, "utf8");
  assert.match(
    text,
    /photosQueryOptions\s*\(/,
    "usePhotos must call photosQueryOptions() (not merely import)",
  );
  assert.match(
    text,
    /enabled:\s*(?:!!user\s*&&\s*!!projectId|Boolean\s*\(\s*user\s*&&\s*projectId\s*\))/,
    "usePhotos must retain auth + projectId gating",
  );
});

// ─── Raw product list keys ───────────────────────────────────────────────────

/** Raw authenticated product photo list keys outside the factory. */
const RAW_PHOTOS_LIST_KEY = /queryKey\s*:\s*\[\s*["']photos["']\s*,/;
/** Reconstructed nested raw key (not via projectKeys.photosByProject). */
const RAW_NESTED_PHOTOS_KEY =
  /queryKey\s*:\s*\[\s*["']projects["']\s*,\s*[^,\]]+,\s*["']photos["']\s*\]/;

test("photos query keys — no raw authenticated product photo list keys outside factory", () => {
  const violations: string[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of listTsFiles(root)) {
      const rel = relPath(file);
      if (rel === CANONICAL_FACTORY) continue;
      const code = stripComments(readFileSync(file, "utf8"));
      if (RAW_PHOTOS_LIST_KEY.test(code) || RAW_NESTED_PHOTOS_KEY.test(code)) {
        violations.push(rel);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `raw authenticated photo list query keys forbidden outside ${CANONICAL_FACTORY}:\n${violations.join("\n")}`,
  );
});

// ─── Direct from("photos") allowlist ─────────────────────────────────────────

const FROM_PHOTOS = /(?:supabase\s*)?\.from\s*\(\s*["']photos["']\s*\)/;

test("photos query keys — from('photos') restricted to transitional allowlist", () => {
  const violations: string[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of listTsFiles(root)) {
      const rel = relPath(file);
      const code = stripComments(readFileSync(file, "utf8"));
      if (!FROM_PHOTOS.test(code)) continue;
      if (PHOTOS_TABLE_ALLOWLIST.has(rel)) continue;
      violations.push(rel);
    }
  }
  assert.deepEqual(
    violations,
    [],
    `supabase.from("photos") outside photos-table allowlist:\n${violations.join("\n")}\nallowed:\n${[...PHOTOS_TABLE_ALLOWLIST].join("\n")}`,
  );
});

// ─── photoStore.list — zero production call sites (C5-2) ─────────────────────

const PHOTOSTORE_LIST = /photoStore\s*\.\s*list\s*\(/;
const FETCH_PROJECT_PHOTOS = /fetchProjectPhotosList\s*\(/;

test("photos query keys — zero production photoStore.list call sites outside store definition", () => {
  const violations: string[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of listTsFiles(root)) {
      const rel = relPath(file);
      if (rel === "src/lib/photos.ts") continue; // definition site may remain until C5-5
      const code = stripComments(readFileSync(file, "utf8"));
      if (PHOTOSTORE_LIST.test(code)) {
        violations.push(rel);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `production photoStore.list forbidden outside src/lib/photos.ts:\n${violations.join("\n")}`,
  );
});

test("photos query keys — AI photo-catalog repository calls fetchProjectPhotosList", () => {
  const full = join(ROOT, PHOTO_CATALOG_REPO);
  assert.ok(existsSync(full), `missing ${PHOTO_CATALOG_REPO}`);
  const text = stripComments(readFileSync(full, "utf8"));
  assert.match(
    text,
    FETCH_PROJECT_PHOTOS,
    `${PHOTO_CATALOG_REPO} must call fetchProjectPhotosList(`,
  );
  assert.doesNotMatch(text, PHOTOSTORE_LIST, `${PHOTO_CATALOG_REPO} must not call photoStore.list`);
  assert.doesNotMatch(
    text,
    FROM_PHOTOS,
    `${PHOTO_CATALOG_REPO} must not call from("photos") directly`,
  );
});

test("photos query keys — AI room-analysis repository calls fetchProjectPhotosList", () => {
  const full = join(ROOT, ROOM_ANALYSIS_REPO);
  assert.ok(existsSync(full), `missing ${ROOM_ANALYSIS_REPO}`);
  const text = stripComments(readFileSync(full, "utf8"));
  assert.match(
    text,
    FETCH_PROJECT_PHOTOS,
    `${ROOM_ANALYSIS_REPO} must call fetchProjectPhotosList(`,
  );
  assert.doesNotMatch(text, PHOTOSTORE_LIST, `${ROOM_ANALYSIS_REPO} must not call photoStore.list`);
  assert.doesNotMatch(
    text,
    FROM_PHOTOS,
    `${ROOM_ANALYSIS_REPO} must not call from("photos") directly`,
  );
});

// ─── Separate surfaces remain allowed (self-contained probes) ────────────────

test("photos query keys — probe: publicPhotos key is permitted", () => {
  const sample = `queryKey: ["publicPhotos", projectId]`;
  assert.match(sample, /\[\s*["']publicPhotos["']\s*,/);
  assert.doesNotMatch(sample, RAW_PHOTOS_LIST_KEY);
});

test("photos query keys — probe: photo-analysis keys are not product list keys", () => {
  const sample = `queryKey: ["photo-analysis", projectId]`;
  assert.doesNotMatch(sample, RAW_PHOTOS_LIST_KEY);
  assert.doesNotMatch(sample, RAW_NESTED_PHOTOS_KEY);
});

test('photos query keys — probe: raw queryKey ["photos", id] is forbidden pattern', () => {
  const sample = `queryKey: ["photos", projectId]`;
  assert.match(sample, RAW_PHOTOS_LIST_KEY);
});

test("photos query keys — probe: photosQueryOptions call-site pattern", () => {
  const good = `return useQuery({ ...photosQueryOptions(projectId), enabled: !!user && !!projectId });`;
  const badImportOnly = `import { photosQueryOptions } from "@/lib/queries/projects";\n// unused`;
  assert.match(good, /photosQueryOptions\s*\(/);
  assert.doesNotMatch(badImportOnly, /photosQueryOptions\s*\(/);
});

// ─── C5-3B2 hook writers → canonical photos-write ───────────────────────────

test("photos query keys — usePhotos hooks call canonical write primitives", () => {
  const hookPath = join(ROOT, USE_PHOTOS_HOOK);
  assert.ok(existsSync(hookPath), `missing ${USE_PHOTOS_HOOK}`);
  const text = stripComments(readFileSync(hookPath, "utf8"));
  assert.match(
    text,
    /uploadProjectPhotos\s*\(/,
    `${USE_PHOTOS_HOOK} must call uploadProjectPhotos(`,
  );
  assert.match(text, /removeProjectPhoto\s*\(/, `${USE_PHOTOS_HOOK} must call removeProjectPhoto(`);
  assert.match(
    text,
    /from\s+["']@\/lib\/photos-write["']/,
    `${USE_PHOTOS_HOOK} must import from @/lib/photos-write`,
  );
});

test("photos query keys — usePhotos hooks must not call photoStore upload/remove", () => {
  const hookPath = join(ROOT, USE_PHOTOS_HOOK);
  const raw = readFileSync(hookPath, "utf8");
  // Strip block + line comments so documentation mentions cannot false-positive.
  const text = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map(stripLineComments)
    .join("\n");
  assert.doesNotMatch(
    text,
    /photoStore\s*\.\s*upload\s*\(/,
    `${USE_PHOTOS_HOOK} must not call photoStore.upload (C5-3B2)`,
  );
  assert.doesNotMatch(
    text,
    /photoStore\s*\.\s*remove\s*\(/,
    `${USE_PHOTOS_HOOK} must not call photoStore.remove (C5-3B2)`,
  );
  // No runtime value import of the store on the migrated hook path.
  assert.doesNotMatch(
    text,
    /\bphotoStore\b/,
    `${USE_PHOTOS_HOOK} must not import or reference photoStore after C5-3B2`,
  );
});

// ─── C5-3B3 BulkPhotoUpload → canonical photos-write ────────────────────────

test("photos query keys — BulkPhotoUpload calls canonical uploadProjectPhotos", () => {
  const bulkPath = join(ROOT, BULK_PHOTO_UPLOAD);
  assert.ok(existsSync(bulkPath), `missing ${BULK_PHOTO_UPLOAD}`);
  const text = stripAllComments(readFileSync(bulkPath, "utf8"));
  assert.match(
    text,
    /from\s+["']@\/lib\/photos-write["']/,
    `${BULK_PHOTO_UPLOAD} must import from @/lib/photos-write`,
  );
  assert.match(
    text,
    /uploadProjectPhotos\s*\(/,
    `${BULK_PHOTO_UPLOAD} must call uploadProjectPhotos(`,
  );
});

test("photos query keys — BulkPhotoUpload bans direct Auth/Storage/photos/store writes", () => {
  const bulkPath = join(ROOT, BULK_PHOTO_UPLOAD);
  const text = stripAllComments(readFileSync(bulkPath, "utf8"));

  assert.doesNotMatch(
    text,
    /supabase\s*\.\s*auth\s*\.\s*getUser\s*\(/,
    `${BULK_PHOTO_UPLOAD} must not call supabase.auth.getUser (C5-3B3)`,
  );
  assert.doesNotMatch(
    text,
    /\bfromSupabaseUser\b/,
    `${BULK_PHOTO_UPLOAD} must not use fromSupabaseUser for write Auth (C5-3B3)`,
  );
  assert.doesNotMatch(
    text,
    /(?:supabase\s*\.\s*)?storage\s*\.\s*from\s*\(/,
    `${BULK_PHOTO_UPLOAD} must not call storage.from (C5-3B3)`,
  );
  assert.doesNotMatch(
    text,
    /(?:supabase\s*)?\.\s*from\s*\(\s*["']photos["']\s*\)/,
    `${BULK_PHOTO_UPLOAD} must not call from("photos") (C5-3B3)`,
  );
  assert.doesNotMatch(
    text,
    /photoStore\s*(?:\.\s*upload\s*\(|\[\s*["']upload["']\s*\])/,
    `${BULK_PHOTO_UPLOAD} must not call photoStore.upload (C5-3B3)`,
  );
  assert.doesNotMatch(
    text,
    /photoStore\s*(?:\.\s*remove\s*\(|\[\s*["']remove["']\s*\])/,
    `${BULK_PHOTO_UPLOAD} must not call photoStore.remove (C5-3B3)`,
  );
  assert.doesNotMatch(
    text,
    /\bp-limit\b|\bpLimit\s*\(/,
    `${BULK_PHOTO_UPLOAD} must not use p-limit (canonical batch concurrency owns this)`,
  );
  assert.doesNotMatch(
    text,
    /\bphotoStore\b/,
    `${BULK_PHOTO_UPLOAD} must not reference photoStore after C5-3B3`,
  );
});

test("photos query keys — BulkPhotoUpload is not on photos-table allowlist", () => {
  assert.equal(
    PHOTOS_TABLE_ALLOWLIST.has(BULK_PHOTO_UPLOAD),
    false,
    `${BULK_PHOTO_UPLOAD} must not remain on PHOTOS_TABLE_ALLOWLIST after C5-3B3`,
  );
});

test("photos query keys — probe: Bulk canonical call pattern required", () => {
  const good = `import { uploadProjectPhotos } from "@/lib/photos-write";\nawait uploadProjectPhotos({ projectId, files, concurrency: 3 });`;
  const importOnly = `import { uploadProjectPhotos } from "@/lib/photos-write";\n// unused`;
  const stringOnly = `const uploadProjectPhotos = "not a real call";`;
  assert.match(good, /uploadProjectPhotos\s*\(/);
  assert.match(good, /from\s+["']@\/lib\/photos-write["']/);
  assert.doesNotMatch(importOnly, /uploadProjectPhotos\s*\(/);
  assert.doesNotMatch(stringOnly, /uploadProjectPhotos\s*\(/);
});

test("photos query keys — probe: Bulk direct-write patterns forbidden", () => {
  const banned = [
    `await supabase.auth.getUser()`,
    `supabase.storage.from("project-photos").upload(path, file)`,
    `storage . from("project-photos")`,
    `await supabase.from("photos").insert({})`,
    `photoStore.upload(projectId, files)`,
    `photoStore["upload"](projectId, files)`,
    `import pLimit from "p-limit"; pLimit(3)`,
  ];
  for (const sample of banned) {
    const text = stripAllComments(sample);
    const hits =
      /supabase\s*\.\s*auth\s*\.\s*getUser\s*\(/.test(text) ||
      /(?:supabase\s*\.\s*)?storage\s*\.\s*from\s*\(/.test(text) ||
      /(?:supabase\s*)?\.\s*from\s*\(\s*["']photos["']\s*\)/.test(text) ||
      /photoStore\s*(?:\.\s*upload\s*\(|\[\s*["']upload["']\s*\])/.test(text) ||
      /\bp-limit\b|\bpLimit\s*\(/.test(text);
    assert.equal(hits, true, `probe should detect banned pattern: ${sample}`);
  }
});
