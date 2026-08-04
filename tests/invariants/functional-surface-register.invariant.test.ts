/**
 * Non-behavioural invariant: P0-APP functional surface register stays machine-valid.
 * Does not assert product behaviour.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const jsonPath = join(root, "docs/operations/app-functional-surface-register.json");
const mdPath = join(root, "docs/operations/app-functional-surface-register.md");
const exceptionsPath = join(root, "docs/operations/app-functional-surface-exceptions.json");
const validatorPath = join(root, "scripts/validate-functional-surface-register.mjs");
const builderPath = join(root, "scripts/build-functional-surface-register.mjs");

const ALLOWED_STATUS = new Set([
  "WORKING",
  "BROKEN",
  "PARTIAL",
  "INACCESSIBLE",
  "BLOCKED_CONFIGURATION",
  "BLOCKED_EXTERNAL",
  "INTENTIONALLY_HIDDEN",
  "NOT_TESTED",
]);

const AR2_CONTROLS = [
  "ctrl.auth.magic-link",
  "ctrl.studies.list.export",
  "ctrl.studies.list.share",
  "ctrl.studies.list.archive",
] as const;

const AR2_BACKEND = [
  "be.trades.job.create",
  "be.trades.job.update",
  "be.trades.job.delete",
  "be.trades.interest.create",
  "be.trades.interest.update",
  "be.trades.profile.upsert",
  "be.marketplace.quote.create",
  "be.marketplace.message.send",
  "be.marketplace.favorite.toggle",
] as const;

const STUDY_BACKEND = [
  "be.studies.queue-export",
  "be.studies.share",
  "be.studies.archive",
] as const;

function loadDoc() {
  return JSON.parse(readFileSync(jsonPath, "utf8"));
}

type RegisterDoc = {
  surfaces: Array<{ surfaceId: string; status: string; kind: string }>;
  counts: Record<string, unknown>;
  [key: string]: unknown;
};

function runValidatorAgainstMutatedDoc(mutator: (doc: RegisterDoc) => void): number {
  const dir = mkdtempSync(join(tmpdir(), "fsr-probe-"));
  try {
    const probeJson = join(dir, "app-functional-surface-register.json");
    const probeMd = join(dir, "app-functional-surface-register.md");
    const probeExc = join(dir, "app-functional-surface-exceptions.json");
    const probeVal = join(dir, "validate.mjs");

    copyFileSync(jsonPath, probeJson);
    copyFileSync(mdPath, probeMd);
    copyFileSync(exceptionsPath, probeExc);

    // Validator uses fixed paths relative to repo root; rewrite a thin wrapper
    // that temporarily swaps JSON via env is not supported. Instead patch a copy
    // of the validator to point at probe paths.
    let valSrc = readFileSync(validatorPath, "utf8");
    valSrc = valSrc
      .replace(
        'const JSON_PATH = join(root, "docs/operations/app-functional-surface-register.json");',
        `const JSON_PATH = ${JSON.stringify(probeJson)};`,
      )
      .replace(
        'const MD_PATH = join(root, "docs/operations/app-functional-surface-register.md");',
        `const MD_PATH = ${JSON.stringify(probeMd)};`,
      )
      .replace(
        'const EXCEPTIONS_PATH = join(root, "docs/operations/app-functional-surface-exceptions.json");',
        `const EXCEPTIONS_PATH = ${JSON.stringify(probeExc)};`,
      );
    writeFileSync(probeVal, valSrc);

    const doc = JSON.parse(readFileSync(probeJson, "utf8")) as RegisterDoc;
    mutator(doc);
    // Recompute counts for pure removal probes so count errors don't mask missing-id failures
    if (Array.isArray(doc.surfaces)) {
      const byStatus: Record<string, number> = {
        WORKING: 0,
        BROKEN: 0,
        PARTIAL: 0,
        INACCESSIBLE: 0,
        BLOCKED_CONFIGURATION: 0,
        BLOCKED_EXTERNAL: 0,
        INTENTIONALLY_HIDDEN: 0,
        NOT_TESTED: 0,
      };
      const byKind = { route: 0, control: 0, backend: 0, integration: 0 };
      for (const s of doc.surfaces) {
        byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
        byKind[s.kind as keyof typeof byKind] = (byKind[s.kind as keyof typeof byKind] ?? 0) + 1;
      }
      doc.counts = {
        ...doc.counts,
        totalSurfaces: doc.surfaces.length,
        routes: byKind.route,
        controls: byKind.control,
        backendOperations: byKind.backend,
        externalIntegrations: byKind.integration,
        byStatus,
        byKind,
      };
    }
    writeFileSync(probeJson, JSON.stringify(doc, null, 2));
    // Keep MD totals in sync enough for non-count failures when only removing IDs
    // (validator also checks MD contains totalSurfaces string)
    let md = readFileSync(probeMd, "utf8");
    const totalSurfaces = String(doc.counts.totalSurfaces ?? doc.surfaces.length);
    const controls = String(doc.counts.controls ?? "");
    const backendOps = String(doc.counts.backendOperations ?? "");
    md = md.replace(
      /\*\*Total surfaces\*\* \| \*\*\d+\*\*/,
      `**Total surfaces** | **${totalSurfaces}**`,
    );
    md = md.replace(/\| Controls \| \d+ \|/, `| Controls | ${controls} |`);
    md = md.replace(/\| Backend operations \| \d+ \|/, `| Backend operations | ${backendOps} |`);
    writeFileSync(probeMd, md);

    const result = spawnSync(process.execPath, [probeVal], {
      cwd: root,
      encoding: "utf8",
    });
    return result.status ?? 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("functional surface register (P0-APP inventory)", () => {
  it("JSON register parses with unique surfaceIds, kinds, and allowed statuses", () => {
    const doc = loadDoc();
    assert.equal(typeof doc.meta?.baselineMainSha, "string");
    assert.equal(doc.meta.runtimeVerificationComplete, false);
    assert.equal(doc.meta.jsonCanonical, true);
    assert.ok(Array.isArray(doc.surfaces));
    assert.ok(
      doc.surfaces.length >= 270,
      `expected AR2 inventory density, got ${doc.surfaces.length}`,
    );

    const ids = new Set<string>();
    const kinds = { route: 0, control: 0, backend: 0, integration: 0 };
    for (const surface of doc.surfaces) {
      assert.equal(typeof surface.surfaceId, "string");
      assert.ok(surface.surfaceId.length > 0);
      assert.equal(ids.has(surface.surfaceId), false, `duplicate ${surface.surfaceId}`);
      ids.add(surface.surfaceId);
      assert.ok(ALLOWED_STATUS.has(surface.status), `bad status ${surface.status}`);
      assert.notEqual(surface.status, "WORKING");
      assert.ok(["route", "control", "backend", "integration"].includes(surface.kind));
      kinds[surface.kind as keyof typeof kinds] += 1;
    }

    assert.equal(doc.counts.totalSurfaces, doc.surfaces.length);
    assert.equal(doc.counts.routes, kinds.route);
    assert.equal(doc.counts.controls, kinds.control);
    assert.equal(doc.counts.backendOperations, kinds.backend);
    assert.equal(doc.counts.externalIntegrations, kinds.integration);
    assert.ok(kinds.control >= 180);
    assert.ok(kinds.backend >= 45);
    assert.ok(kinds.integration >= 10);
  });

  it("records known P0 analyze photo defects on main baseline", () => {
    const doc = loadDoc();
    for (const id of [
      "ctrl.analyze.photo.take",
      "ctrl.analyze.photo.library",
      "ctrl.analyze.photo.camera-input",
      "ctrl.analyze.project-select",
    ]) {
      const surface = doc.surfaces.find((s: { surfaceId: string }) => s.surfaceId === id);
      assert.ok(surface, `${id} must be inventoried`);
      assert.equal(surface.status, "BROKEN");
      assert.equal(surface.severity, "P0");
      assert.ok(surface.blocker);
    }
  });

  it("includes Magic Link control on /auth", () => {
    const doc = loadDoc();
    const magic = doc.surfaces.find(
      (s: { surfaceId: string }) => s.surfaceId === "ctrl.auth.magic-link",
    );
    assert.ok(magic, "ctrl.auth.magic-link must exist");
    assert.equal(magic.kind, "control");
    assert.equal(magic.route, "/auth");
    assert.notEqual(magic.status, "WORKING");
    assert.match(String(magic.control), /magic link/i);
  });

  it("includes distinct Studies list Export, Share, and Archive controls", () => {
    const doc = loadDoc();
    const ids = new Set(doc.surfaces.map((s: { surfaceId: string }) => s.surfaceId));
    for (const id of AR2_CONTROLS.filter((x) => x.startsWith("ctrl.studies"))) {
      assert.ok(ids.has(id), `${id} must exist`);
      const s = doc.surfaces.find((x: { surfaceId: string }) => x.surfaceId === id);
      assert.equal(s.kind, "control");
      assert.equal(s.route, "/studies");
    }
    assert.equal(ids.has("ctrl.studies.create-actions"), false);
  });

  it("includes all six required Trades backend operations", () => {
    const doc = loadDoc();
    const ids = new Set(doc.surfaces.map((s: { surfaceId: string }) => s.surfaceId));
    for (const id of [
      "be.trades.job.create",
      "be.trades.job.update",
      "be.trades.job.delete",
      "be.trades.interest.create",
      "be.trades.interest.update",
      "be.trades.profile.upsert",
    ]) {
      assert.ok(ids.has(id), `${id} must exist`);
      const s = doc.surfaces.find((x: { surfaceId: string }) => x.surfaceId === id);
      assert.equal(s.kind, "backend");
    }
  });

  it("includes all three required Marketplace backend operations", () => {
    const doc = loadDoc();
    const ids = new Set(doc.surfaces.map((s: { surfaceId: string }) => s.surfaceId));
    for (const id of AR2_BACKEND.filter((x) => x.startsWith("be.marketplace"))) {
      assert.ok(ids.has(id), `${id} must exist`);
      const s = doc.surfaces.find((x: { surfaceId: string }) => x.surfaceId === id);
      assert.equal(s.kind, "backend");
    }
  });

  it("includes separate study export/share/archive backend operations", () => {
    const doc = loadDoc();
    const ids = new Set(doc.surfaces.map((s: { surfaceId: string }) => s.surfaceId));
    for (const id of STUDY_BACKEND) {
      assert.ok(ids.has(id), `${id} must exist`);
    }
  });

  it("admin route is not INTENTIONALLY_HIDDEN; sidebar admin link may be", () => {
    const doc = loadDoc();
    const route = doc.surfaces.find((s: { surfaceId: string }) => s.surfaceId === "route.admin");
    assert.ok(route);
    assert.notEqual(route.status, "INTENTIONALLY_HIDDEN");
    const nav = doc.surfaces.find(
      (s: { surfaceId: string }) => s.surfaceId === "ctrl.nav.sidebar.admin-absent",
    );
    assert.ok(nav);
    assert.equal(nav.status, "INTENTIONALLY_HIDDEN");
  });

  it("markdown twin and exceptions exist and match JSON totals", () => {
    const doc = loadDoc();
    const md = readFileSync(mdPath, "utf8");
    const exceptions = JSON.parse(readFileSync(exceptionsPath, "utf8"));
    assert.match(md, /app-functional-surface-register\.json/);
    assert.match(md, /P0-APP-AR2|P0-APP-AR|P0-APP-A/);
    assert.match(md, new RegExp(doc.meta.baselineMainSha));
    assert.match(md, new RegExp(String(doc.counts.totalSurfaces)));
    assert.match(md, new RegExp(String(doc.counts.controls)));
    assert.ok(Array.isArray(exceptions.routeSourceAllowlist));
    assert.ok(exceptions.routeSourceAllowlist.length >= 2);
  });

  it("validate-functional-surface-register.mjs exits 0", () => {
    const result = spawnSync(process.execPath, [validatorPath], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });

  it("validator fails when a newly required control is removed", () => {
    const status = runValidatorAgainstMutatedDoc((doc) => {
      doc.surfaces = doc.surfaces.filter(
        (s: { surfaceId: string }) => s.surfaceId !== "ctrl.auth.magic-link",
      );
    });
    assert.notEqual(status, 0);
  });

  it("validator fails when a newly required backend operation is removed", () => {
    const status = runValidatorAgainstMutatedDoc((doc) => {
      doc.surfaces = doc.surfaces.filter(
        (s: { surfaceId: string }) => s.surfaceId !== "be.trades.job.create",
      );
    });
    assert.notEqual(status, 0);
  });

  it("builder regeneration is deterministic (zero git-visible drift)", () => {
    const beforeJson = readFileSync(jsonPath);
    const beforeMd = readFileSync(mdPath);
    const result = spawnSync(process.execPath, [builderPath], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const afterJson = readFileSync(jsonPath);
    const afterMd = readFileSync(mdPath);
    assert.deepEqual(afterJson, beforeJson);
    assert.deepEqual(afterMd, beforeMd);
  });
});
