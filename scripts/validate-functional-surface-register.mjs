#!/usr/bin/env node
/**
 * Non-behavioural harness for P0-APP-A functional surface register.
 * Validates machine-readable inventory shape only — does not claim surfaces work.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const jsonPath = join(root, "docs/operations/app-functional-surface-register.json");

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

const ALLOWED_SEVERITY = new Set(["P0", "P1", "P2", "P3"]);

const REQUIRED_SURFACE_FIELDS = [
  "surfaceId",
  "area",
  "route",
  "control",
  "sourcePath",
  "role",
  "entitlement",
  "preconditions",
  "operation",
  "persistence",
  "expectedResult",
  "actualResult",
  "status",
  "severity",
  "testReference",
  "blocker",
  "notes",
];

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function main() {
  let doc;
  try {
    doc = JSON.parse(readFileSync(jsonPath, "utf8"));
  } catch (error) {
    fail(`Unable to read/parse register: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  if (!doc.meta || typeof doc.meta !== "object") {
    fail("meta object required");
  }
  if (!doc.meta.baselineMainSha || typeof doc.meta.baselineMainSha !== "string") {
    fail("meta.baselineMainSha required");
  }
  if (doc.meta.runtimeVerificationComplete === true) {
    fail("runtimeVerificationComplete must remain false for audit-only inventory unless re-authorised");
  }
  if (!Array.isArray(doc.surfaces) || doc.surfaces.length === 0) {
    fail("surfaces array must be non-empty");
  }

  const ids = new Set();
  const statusCounts = Object.create(null);
  for (const status of ALLOWED_STATUS) statusCounts[status] = 0;

  for (const surface of doc.surfaces) {
    for (const field of REQUIRED_SURFACE_FIELDS) {
      if (!(field in surface)) {
        fail(`surface missing field ${field}: ${surface.surfaceId ?? "<unknown>"}`);
      }
    }
    if (!surface.surfaceId || typeof surface.surfaceId !== "string") {
      fail("surfaceId must be non-empty string");
      continue;
    }
    if (ids.has(surface.surfaceId)) {
      fail(`duplicate surfaceId: ${surface.surfaceId}`);
    }
    ids.add(surface.surfaceId);

    if (!ALLOWED_STATUS.has(surface.status)) {
      fail(`${surface.surfaceId}: invalid status ${surface.status}`);
    } else {
      statusCounts[surface.status] += 1;
    }
    if (!ALLOWED_SEVERITY.has(surface.severity)) {
      fail(`${surface.surfaceId}: invalid severity ${surface.severity}`);
    }
    if (surface.status === "WORKING") {
      fail(
        `${surface.surfaceId}: WORKING is forbidden in P0-APP-A static inventory without runtime evidence`,
      );
    }
    if (!Array.isArray(surface.preconditions)) {
      fail(`${surface.surfaceId}: preconditions must be an array`);
    }
  }

  if (!doc.counts || typeof doc.counts !== "object") {
    fail("counts object required");
  }

  const p0Broken = doc.surfaces.filter((s) => s.severity === "P0" && s.status === "BROKEN");
  if (p0Broken.length === 0) {
    // Inventory is expected to find at least the known photo defect on main.
    console.warn(
      "WARN: no P0 BROKEN surfaces recorded — confirm inventory completeness against known photo defect on main",
    );
  }

  if (process.exitCode && process.exitCode !== 0) {
    console.error("Functional surface register validation failed.");
    return;
  }

  console.log("OK: functional surface register schema valid");
  console.log(`  path: ${jsonPath}`);
  console.log(`  surfaces: ${doc.surfaces.length}`);
  console.log(`  unique ids: ${ids.size}`);
  console.log(`  status totals: ${JSON.stringify(statusCounts)}`);
  console.log(`  P0 BROKEN: ${p0Broken.map((s) => s.surfaceId).join(", ") || "(none)"}`);
  console.log(`  baseline: ${doc.meta.baselineMainSha}`);
  console.log(`  runtimeVerificationComplete: ${doc.meta.runtimeVerificationComplete}`);
}

main();
