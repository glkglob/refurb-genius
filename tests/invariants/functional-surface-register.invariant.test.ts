/**
 * Non-behavioural invariant: P0-APP-A operational register stays machine-valid.
 * Does not assert product behaviour.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const jsonPath = join(root, "docs/operations/app-functional-surface-register.json");
const mdPath = join(root, "docs/operations/app-functional-surface-register.md");

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

describe("functional surface register (P0-APP-A inventory)", () => {
  it("JSON register parses and has unique surfaceIds with allowed statuses", () => {
    const doc = JSON.parse(readFileSync(jsonPath, "utf8"));
    assert.equal(typeof doc.meta?.baselineMainSha, "string");
    assert.equal(doc.meta.runtimeVerificationComplete, false);
    assert.ok(Array.isArray(doc.surfaces));
    assert.ok(doc.surfaces.length >= 30);

    const ids = new Set<string>();
    for (const surface of doc.surfaces) {
      assert.equal(typeof surface.surfaceId, "string");
      assert.ok(surface.surfaceId.length > 0);
      assert.equal(ids.has(surface.surfaceId), false, `duplicate ${surface.surfaceId}`);
      ids.add(surface.surfaceId);
      assert.ok(ALLOWED_STATUS.has(surface.status), `bad status ${surface.status}`);
      // Audit-only: do not claim WORKING without runtime evidence.
      assert.notEqual(surface.status, "WORKING");
    }
  });

  it("records known P0 analyze photo defect on main baseline", () => {
    const doc = JSON.parse(readFileSync(jsonPath, "utf8"));
    const take = doc.surfaces.find((s: { surfaceId: string }) => s.surfaceId === "ctrl.analyze.photo.take");
    assert.ok(take, "ctrl.analyze.photo.take must be inventoried");
    assert.equal(take.status, "BROKEN");
    assert.equal(take.severity, "P0");
  });

  it("markdown twin exists and references JSON register", () => {
    const md = readFileSync(mdPath, "utf8");
    assert.match(md, /app-functional-surface-register\.json/);
    assert.match(md, /P0-APP-A/);
    assert.match(md, /b2041176bfbcc9aea83cffd69da8161884638deb/);
  });
});
