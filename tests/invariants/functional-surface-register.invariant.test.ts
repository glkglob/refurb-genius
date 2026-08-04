/**
 * Non-behavioural invariant: P0-APP functional surface register stays machine-valid.
 * Does not assert product behaviour.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const jsonPath = join(root, "docs/operations/app-functional-surface-register.json");
const mdPath = join(root, "docs/operations/app-functional-surface-register.md");
const exceptionsPath = join(root, "docs/operations/app-functional-surface-exceptions.json");
const validatorPath = join(root, "scripts/validate-functional-surface-register.mjs");

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

describe("functional surface register (P0-APP inventory)", () => {
  it("JSON register parses with unique surfaceIds, kinds, and allowed statuses", () => {
    const doc = JSON.parse(readFileSync(jsonPath, "utf8"));
    assert.equal(typeof doc.meta?.baselineMainSha, "string");
    assert.equal(doc.meta.runtimeVerificationComplete, false);
    assert.equal(doc.meta.jsonCanonical, true);
    assert.ok(Array.isArray(doc.surfaces));
    assert.ok(doc.surfaces.length >= 200, `expected dense inventory, got ${doc.surfaces.length}`);

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
    assert.ok(kinds.control >= 100);
    assert.ok(kinds.backend >= 20);
    assert.ok(kinds.integration >= 10);
  });

  it("records known P0 analyze photo defects on main baseline", () => {
    const doc = JSON.parse(readFileSync(jsonPath, "utf8"));
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

  it("admin route is not INTENTIONALLY_HIDDEN; sidebar admin link may be", () => {
    const doc = JSON.parse(readFileSync(jsonPath, "utf8"));
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
    const doc = JSON.parse(readFileSync(jsonPath, "utf8"));
    const md = readFileSync(mdPath, "utf8");
    const exceptions = JSON.parse(readFileSync(exceptionsPath, "utf8"));
    assert.match(md, /app-functional-surface-register\.json/);
    assert.match(md, /P0-APP-AR|P0-APP-A/);
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
});
