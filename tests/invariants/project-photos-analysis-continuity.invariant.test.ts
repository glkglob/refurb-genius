/**
 * IA-3 invariant: Photos → Analysis continuity authority.
 *
 * Locks durable catalogue identity, production validity, adapter ownership,
 * and absence of first-class Redesign route / Scope provenance work.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("IA-3 durable photo catalogue identity uses photo ids only", () => {
  const rules = read("src/features/ai-upload/domain/rules.ts");
  assert.match(rules, /export function durablePhotoCatalogueIdentity/);
  assert.match(rules, /signed URL/);
  // Fingerprint delegates to durable ids (not URL-only identity).
  assert.match(rules, /catalogueIdentityFingerprint/);
  assert.match(rules, /durablePhotoCatalogueIdentity\(catalogue\)/);
});

test("IA-3 production validity rejects mock and requires photo_id set match", () => {
  const rules = read("src/features/ai-upload/domain/rules.ts");
  assert.match(rules, /export function isProductionValidAnalysisSet/);
  assert.match(rules, /hasMockAnalysis/);
  assert.match(rules, /source !== "ai"/);
});

test("IA-3 Photos/Analysis workflow adapter is pure and exported", () => {
  const adapter = read("src/features/projects/domain/photosAnalysisWorkflowAdapter.ts");
  assert.match(adapter, /buildPhotosAnalysisWorkflowState/);
  assert.match(adapter, /photosCurrencyFromEvidence/);
  assert.match(adapter, /analysisCurrencyFromEvidence/);
  assert.doesNotMatch(adapter, /from ["']react["']/);
  assert.doesNotMatch(adapter, /from ["']@supabase\//);
  assert.doesNotMatch(adapter, /createServerFn/);
  assert.doesNotMatch(adapter, /from ["']@\/platform\//);

  const pub = read("src/features/projects/index.ts");
  assert.match(pub, /buildPhotosAnalysisWorkflowState/);
  assert.match(pub, /resolveProjectNextAction/);
});

test("IA-3 Photos and Analysis routes consume canonical resolver", () => {
  const upload = read("src/routes/_authed/projects.$id.upload.tsx");
  const analysis = read("src/routes/_authed/projects.$id.analysis.tsx");
  assert.match(upload, /resolveProjectNextAction/);
  assert.match(upload, /buildPhotosAnalysisWorkflowState/);
  assert.match(analysis, /resolveProjectNextAction/);
  assert.match(analysis, /buildPhotosAnalysisWorkflowState/);
  // Must not skip Redesign as permanent primary continuation.
  assert.match(analysis, /create_redesign|focus: "redesign"|focus: 'redesign'/);
});

test("IA-3 does not introduce first-class /redesign or Scope provenance migration", () => {
  assert.equal(existsSync(join(ROOT, "src/routes/_authed/projects.$id.redesign.tsx")), false);
  // Lexical: adapter must not invent redesign_done or estimate/export provenance fields.
  const adapter = read("src/features/projects/domain/photosAnalysisWorkflowAdapter.ts");
  assert.doesNotMatch(adapter, /redesign_done|estimate_fingerprint|export_fingerprint/);
});

test("IA-3 replace_project_room_analyses remains the analysis publish authority", () => {
  const repo = read(
    "src/features/ai-upload/infrastructure/repositories/room-analysis.repository.ts",
  );
  assert.match(repo, /replace_project_room_analyses/);
  assert.match(repo, /fetchProjectPhotosList|listPhotos|photo/);
});
