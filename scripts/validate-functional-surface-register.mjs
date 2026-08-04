#!/usr/bin/env node
/**
 * P0-APP-AR functional surface register validator.
 *
 * Reconciles:
 * - routeTree.gen.ts fullPaths ↔ registered kind=route surfaces
 * - route source files ↔ register + exceptions allowlist
 * - surface IDs, statuses, kinds, counts, known P0 controls
 * - sourcePath existence
 *
 * Does NOT claim perfect TSX AST control discovery.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const JSON_PATH = join(root, "docs/operations/app-functional-surface-register.json");
const MD_PATH = join(root, "docs/operations/app-functional-surface-register.md");
const EXCEPTIONS_PATH = join(root, "docs/operations/app-functional-surface-exceptions.json");
const ROUTE_TREE_PATH = join(root, "src/routeTree.gen.ts");
const ROUTES_DIR = join(root, "src/routes");

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
const ALLOWED_KIND = new Set(["route", "control", "backend", "integration"]);

const REQUIRED_SURFACE_FIELDS = [
  "surfaceId",
  "kind",
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

let failures = 0;
function fail(message) {
  console.error(`FAIL: ${message}`);
  failures += 1;
}

function warn(message) {
  console.warn(`WARN: ${message}`);
}

function normalizePath(p) {
  if (!p || p === "/") return "/";
  return p.replace(/\/$/, "") || "/";
}

function walkFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function parseRouteTreeFullPaths(treeSource) {
  const re = /fullPath:\s*['"`]([^'"`]+)['"`]/g;
  const paths = new Set();
  for (const match of treeSource.matchAll(re)) {
    paths.add(normalizePath(match[1]));
  }
  return paths;
}

function parseRouteTreeSourceImports(treeSource) {
  const re = /from\s+['"](\.\/routes\/[^'"]+)['"]/g;
  const sources = new Set();
  for (const match of treeSource.matchAll(re)) {
    // routeTree imports omit extension; map to .tsx/.ts
    const base = match[1].replace(/^\.\//, "src/");
    if (existsSync(join(root, `${base}.tsx`))) sources.add(`${base}.tsx`);
    else if (existsSync(join(root, `${base}.ts`))) sources.add(`${base}.ts`);
    else sources.add(`${base}.tsx`);
  }
  return sources;
}

function main() {
  if (!existsSync(JSON_PATH)) {
    fail(`missing register JSON: ${JSON_PATH}`);
    process.exit(1);
  }
  if (!existsSync(MD_PATH)) {
    fail(`missing register Markdown: ${MD_PATH}`);
    process.exit(1);
  }
  if (!existsSync(EXCEPTIONS_PATH)) {
    fail(`missing exceptions file: ${EXCEPTIONS_PATH}`);
    process.exit(1);
  }
  if (!existsSync(ROUTE_TREE_PATH)) {
    fail(`missing route tree: ${ROUTE_TREE_PATH}`);
    process.exit(1);
  }

  /** @type {any} */
  let doc;
  /** @type {any} */
  let exceptions;
  try {
    doc = JSON.parse(readFileSync(JSON_PATH, "utf8"));
    exceptions = JSON.parse(readFileSync(EXCEPTIONS_PATH, "utf8"));
  } catch (error) {
    fail(`parse error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const md = readFileSync(MD_PATH, "utf8");
  const routeTree = readFileSync(ROUTE_TREE_PATH, "utf8");
  const fullPaths = parseRouteTreeFullPaths(routeTree);
  const treeSources = parseRouteTreeSourceImports(routeTree);

  if (!doc.meta || typeof doc.meta !== "object") fail("meta object required");
  if (doc.meta.runtimeVerificationComplete === true) {
    fail("runtimeVerificationComplete must be false for audit-only inventory");
  }
  if (doc.meta.jsonCanonical !== true) {
    fail("meta.jsonCanonical must be true");
  }
  if (!Array.isArray(doc.surfaces) || doc.surfaces.length === 0) {
    fail("surfaces must be non-empty array");
  }

  // Exceptions shape
  for (const key of ["routeSourceAllowlist", "generatedFileAllowlist"]) {
    if (!Array.isArray(exceptions[key])) fail(`exceptions.${key} must be array`);
  }
  for (const listName of [
    "routeSourceAllowlist",
    "generatedFileAllowlist",
    "controlDiscoveryNotes",
  ]) {
    for (const item of exceptions[listName] ?? []) {
      for (const field of ["sourcePath", "reason", "owner", "reviewDate"]) {
        if (!item[field]) fail(`exceptions.${listName} item missing ${field}`);
      }
    }
  }

  const allowlistedRouteSources = new Set(
    (exceptions.routeSourceAllowlist ?? []).map((e) => e.sourcePath),
  );
  const allowlistedGenerated = new Set(
    (exceptions.generatedFileAllowlist ?? []).map((e) => e.sourcePath),
  );

  const ids = new Set();
  const statusCounts = Object.fromEntries([...ALLOWED_STATUS].map((s) => [s, 0]));
  const kindCounts = { route: 0, control: 0, backend: 0, integration: 0 };
  const registeredRoutePaths = new Set();
  const registeredRouteSources = new Set();

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
    if (ids.has(surface.surfaceId)) fail(`duplicate surfaceId: ${surface.surfaceId}`);
    ids.add(surface.surfaceId);

    if (!ALLOWED_KIND.has(surface.kind)) {
      fail(`${surface.surfaceId}: invalid kind ${surface.kind}`);
    } else {
      kindCounts[surface.kind] += 1;
    }

    if (!ALLOWED_STATUS.has(surface.status)) {
      fail(`${surface.surfaceId}: invalid status ${surface.status}`);
    } else {
      statusCounts[surface.status] += 1;
    }

    if (!ALLOWED_SEVERITY.has(surface.severity)) {
      fail(`${surface.surfaceId}: invalid severity ${surface.severity}`);
    }

    if (surface.status === "WORKING") {
      fail(`${surface.surfaceId}: WORKING forbidden during audit-only inventory`);
    }

    if (!Array.isArray(surface.preconditions)) {
      fail(`${surface.surfaceId}: preconditions must be array`);
    }

    if (
      (surface.status === "BROKEN" ||
        surface.status === "BLOCKED_CONFIGURATION" ||
        surface.status === "BLOCKED_EXTERNAL") &&
      !surface.blocker
    ) {
      fail(`${surface.surfaceId}: blocker required for status ${surface.status}`);
    }

    // sourcePath existence (allow feature directory roots and wildcards)
    const sp = surface.sourcePath;
    if (sp && !sp.includes("*")) {
      const abs = join(root, sp);
      if (!existsSync(abs)) {
        fail(`${surface.surfaceId}: sourcePath does not exist: ${sp}`);
      }
    }

    // testReference if set must exist
    if (surface.testReference) {
      const tr = join(root, surface.testReference);
      if (!existsSync(tr)) {
        fail(`${surface.surfaceId}: testReference does not exist: ${surface.testReference}`);
      }
    }

    if (surface.kind === "route") {
      // Pathless layout gate is registered but not a fullPath
      if (surface.route === "/_authed") {
        registeredRouteSources.add(surface.sourcePath);
        continue;
      }
      const norm = normalizePath(surface.route);
      if (registeredRoutePaths.has(norm)) {
        fail(`duplicate route identity: ${norm}`);
      }
      registeredRoutePaths.add(norm);
      registeredRouteSources.add(surface.sourcePath);

      // Auth class consistency for known patterns
      if (surface.authClass === "public" && surface.role === "admin") {
        fail(`${surface.surfaceId}: public authClass cannot be admin role`);
      }
      if (surface.authClass === "admin" && surface.role !== "admin") {
        fail(`${surface.surfaceId}: admin authClass requires admin role`);
      }
      if (surface.route.startsWith("/admin") && surface.authClass !== "admin") {
        fail(`${surface.surfaceId}: /admin must be authClass admin`);
      }
    }

    // Category/kind mismatch: control IDs should not use route. prefix
    if (surface.kind === "control" && surface.surfaceId.startsWith("route.")) {
      fail(`${surface.surfaceId}: control kind cannot use route. prefix`);
    }
    if (surface.kind === "route" && surface.surfaceId.startsWith("ctrl.")) {
      fail(`${surface.surfaceId}: route kind cannot use ctrl. prefix`);
    }
    if (surface.kind === "backend" && !surface.surfaceId.startsWith("be.")) {
      fail(`${surface.surfaceId}: backend surfaces should use be. prefix`);
    }
    if (surface.kind === "integration" && !surface.surfaceId.startsWith("int.")) {
      fail(`${surface.surfaceId}: integration surfaces should use int. prefix`);
    }
  }

  // Route tree reconciliation
  for (const fullPath of fullPaths) {
    if (!registeredRoutePaths.has(fullPath)) {
      fail(`production route fullPath not registered: ${fullPath}`);
    }
  }
  for (const registered of registeredRoutePaths) {
    if (!fullPaths.has(registered)) {
      fail(`registered route not present in routeTree fullPaths: ${registered}`);
    }
  }

  // Route source files on disk vs register + allowlist
  const routeFiles = walkFiles(ROUTES_DIR)
    .map((f) => relative(root, f))
    .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.includes(".test."));

  for (const file of routeFiles) {
    if (allowlistedRouteSources.has(file)) continue;
    if (allowlistedGenerated.has(file)) continue;
    // Must be either registered as route source or present in tree imports
    const isRegistered = registeredRouteSources.has(file);
    const inTree = treeSources.has(file);
    if (!isRegistered && inTree) {
      fail(`route source in routeTree but not registered: ${file}`);
    }
    if (!isRegistered && !inTree) {
      // leftover? still should be allowlisted or registered
      fail(`route source file not registered and not allowlisted: ${file}`);
    }
  }

  // Counts consistency (derived, not stale manual)
  if (!doc.counts || typeof doc.counts !== "object") fail("counts object required");
  if (doc.counts.totalSurfaces !== doc.surfaces.length) {
    fail(
      `counts.totalSurfaces ${doc.counts.totalSurfaces} !== surfaces.length ${doc.surfaces.length}`,
    );
  }
  if (doc.counts.routes !== kindCounts.route) {
    fail(`counts.routes ${doc.counts.routes} !== derived ${kindCounts.route}`);
  }
  if (doc.counts.controls !== kindCounts.control) {
    fail(`counts.controls ${doc.counts.controls} !== derived ${kindCounts.control}`);
  }
  if (doc.counts.backendOperations !== kindCounts.backend) {
    fail(
      `counts.backendOperations ${doc.counts.backendOperations} !== derived ${kindCounts.backend}`,
    );
  }
  if (doc.counts.externalIntegrations !== kindCounts.integration) {
    fail(
      `counts.externalIntegrations ${doc.counts.externalIntegrations} !== derived ${kindCounts.integration}`,
    );
  }
  for (const st of ALLOWED_STATUS) {
    const expected = statusCounts[st] ?? 0;
    const actual = doc.counts.byStatus?.[st] ?? -1;
    if (actual !== expected) {
      fail(`counts.byStatus.${st} ${actual} !== derived ${expected}`);
    }
  }

  // Known required P0 controls
  const required = doc.knownRequiredControls ?? [
    "ctrl.analyze.photo.take",
    "ctrl.analyze.photo.library",
    "ctrl.analyze.photo.camera-input",
    "ctrl.analyze.project-select",
    "ctrl.auth.signin-submit",
    "ctrl.auth.signup-submit",
    "ctrl.settings.save",
    "ctrl.admin.gate",
  ];
  for (const id of required) {
    if (!ids.has(id)) fail(`required surface missing: ${id}`);
  }

  // Known photo defects must be BROKEN
  for (const id of [
    "ctrl.analyze.photo.take",
    "ctrl.analyze.photo.library",
    "ctrl.analyze.photo.camera-input",
    "ctrl.analyze.project-select",
  ]) {
    const s = doc.surfaces.find((x) => x.surfaceId === id);
    if (!s) continue;
    if (s.status !== "BROKEN") fail(`${id} must be BROKEN on main baseline inventory`);
    if (s.severity !== "P0") fail(`${id} must be severity P0`);
  }

  // Settings false-success must be BROKEN
  const settingsSave = doc.surfaces.find((x) => x.surfaceId === "ctrl.settings.save");
  if (!settingsSave || settingsSave.status !== "BROKEN") {
    fail("ctrl.settings.save must be BROKEN (false-success profile save)");
  }

  // Admin route must not be INTENTIONALLY_HIDDEN (reachable URL)
  const adminRoute = doc.surfaces.find((x) => x.surfaceId === "route.admin");
  if (adminRoute?.status === "INTENTIONALLY_HIDDEN") {
    fail("route.admin must not be INTENTIONALLY_HIDDEN (route is URL-reachable)");
  }

  // Markdown consistency with JSON counts
  if (!md.includes("app-functional-surface-register.json")) {
    fail("Markdown must reference JSON twin");
  }
  if (!md.includes(String(doc.counts.totalSurfaces))) {
    fail("Markdown must include totalSurfaces count from JSON");
  }
  if (!md.includes(String(doc.counts.controls))) {
    fail("Markdown must include controls count from JSON");
  }
  if (!md.includes(doc.meta.baselineMainSha)) {
    fail("Markdown must include baseline SHA");
  }
  // Status lines
  for (const st of ["WORKING", "BROKEN", "NOT_TESTED"]) {
    if (!md.includes(st)) fail(`Markdown missing status token ${st}`);
  }

  // Minimum completeness floors (prevent regression to sparse inventory)
  if (kindCounts.control < 100) {
    fail(`control count ${kindCounts.control} below completeness floor 100`);
  }
  if (kindCounts.backend < 20) {
    fail(`backend count ${kindCounts.backend} below completeness floor 20`);
  }
  if (kindCounts.integration < 10) {
    fail(`integration count ${kindCounts.integration} below completeness floor 10`);
  }
  if (fullPaths.size < 30) {
    fail(`routeTree fullPaths ${fullPaths.size} unexpectedly small`);
  }

  if (failures > 0) {
    console.error(`\nFunctional surface register validation failed with ${failures} error(s).`);
    process.exit(1);
  }

  console.log("OK: functional surface register validation passed");
  console.log(`  json: ${JSON_PATH}`);
  console.log(`  exceptions: ${EXCEPTIONS_PATH}`);
  console.log(`  routeTree fullPaths: ${fullPaths.size}`);
  console.log(`  surfaces: ${doc.surfaces.length}`);
  console.log(
    `  kinds: routes=${kindCounts.route} controls=${kindCounts.control} backend=${kindCounts.backend} integrations=${kindCounts.integration}`,
  );
  console.log(`  status: ${JSON.stringify(statusCounts)}`);
  console.log(`  baseline: ${doc.meta.baselineMainSha}`);
  console.log(`  phase: ${doc.meta.phase}`);
  console.log("  note: perfect AST control discovery is NOT claimed");
}

main();
