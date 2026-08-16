/**
 * SEC-1B-GALLERY-B — public gallery retrieval is cover-only.
 *
 * Seals the gallery feature contract and already-safe public surfaces so they
 * cannot grow a private project-photo retrieval dependency.
 *
 * Known residual (GALLERY-D): src/routes/gallery.$slug.tsx still calls
 * publicProjectPhotosQueryOptions. That file is excluded here on purpose.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

const FEATURE_ROOT = join(ROOT, "src/features/gallery");
const PUBLIC_SURFACES = [
  "src/routes/gallery.tsx",
  "src/components/gallery/ProjectCard.tsx",
  "src/components/gallery/LeadCaptureForm.tsx",
] as const;

const FORBIDDEN = [
  { pattern: /publicProjectPhotosQueryOptions/, label: "publicProjectPhotosQueryOptions" },
  { pattern: /createSignedUrl/, label: "createSignedUrl" },
  { pattern: /projectPhotoDisplay/, label: "project-photo signed retrieval" },
  { pattern: /useProjectPhotoDisplayUrl/, label: "useProjectPhotoDisplayUrl" },
  { pattern: /from\(\s*["']photos["']\s*\)/, label: "photos table query" },
  { pattern: /service_role/, label: "service_role" },
  { pattern: /project-photos/, label: "project-photos bucket" },
] as const;

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
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

function isTestFile(path: string): boolean {
  return /\.test\.(ts|tsx)$/.test(path);
}

function read(relOrAbs: string): string {
  const full = relOrAbs.startsWith("/") ? relOrAbs : join(ROOT, relOrAbs);
  assert.ok(existsSync(full), `missing ${relative(ROOT, full)}`);
  return stripAllComments(readFileSync(full, "utf8"));
}

test("gallery public-retrieval — feature contract forbids private photo retrieval", () => {
  const productionFiles = listTsFiles(FEATURE_ROOT).filter((file) => !isTestFile(file));
  assert.ok(productionFiles.length > 0, "gallery feature files must exist");

  const violations: string[] = [];
  for (const file of productionFiles) {
    const text = read(file);
    const rel = relative(ROOT, file);
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(text)) {
        violations.push(`${rel}: ${rule.label}`);
      }
    }
  }

  assert.deepEqual(violations, [], `forbidden public-gallery retrieval:\n${violations.join("\n")}`);
});

test("gallery public-retrieval — list/card/lead surfaces do not use project photos", () => {
  const violations: string[] = [];
  for (const rel of PUBLIC_SURFACES) {
    const text = read(rel);
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(text)) {
        violations.push(`${rel}: ${rule.label}`);
      }
    }
  }
  assert.deepEqual(violations, [], `forbidden public surface retrieval:\n${violations.join("\n")}`);
});

test("gallery public-retrieval — domain names cover as the public image", () => {
  const types = read("src/features/gallery/domain/types.ts");
  assert.match(types, /coverImageUrl/, "domain must name coverImageUrl");
  assert.match(types, /PublicGalleryPublication/, "domain must export PublicGalleryPublication");
  assert.match(types, /already_absent/, "domain must distinguish already_absent");
  assert.match(types, /failed/, "domain must distinguish failed revocation");
  assert.match(
    types,
    /isGalleryUnpublishPrivacyComplete/,
    "domain must encode unpublish privacy completeness",
  );
});

test("gallery public-retrieval — repository stays listing + cover", () => {
  const repo = read("src/features/gallery/infrastructure/galleryRepository.ts");
  assert.match(repo, /public_gallery_projects/, "repository targets public_gallery_projects");
  assert.match(repo, /cover_image_url/, "repository persists cover_image_url");
  assert.match(repo, /toPublicGalleryPublication/, "repository maps public cover identity");
  assert.doesNotMatch(repo, /from\(\s*["']photos["']\s*\)/, "repository must not query photos");
});

test("gallery public-retrieval — cover lifecycle port distinguishes delete failure", () => {
  const ports = read("src/features/gallery/application/ports.ts");
  assert.match(ports, /GalleryCoverLifecycle/, "ports must define cover lifecycle");
  assert.match(ports, /revokeCover/, "ports must expose revokeCover");
  assert.match(ports, /listPublicPublications/, "ports must support public listing read");
  assert.match(ports, /getPublicPublicationById/, "ports must support public detail read");
});
