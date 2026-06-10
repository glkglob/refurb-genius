/**
 * Route inventory invariant tests.
 *
 * Verifies that critical route files exist and that the route documentation
 * correctly captures the public vs authenticated distinction.
 * Catches accidental route file deletion and doc staleness.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const ROUTES = join(ROOT, "src/routes");
const ROUTES_DOC = join(ROOT, "docs/architecture/routes.md");

function routeExists(file: string): boolean {
  return existsSync(join(ROUTES, file));
}

// ── Public routes ─────────────────────────────────────────────────────────────

const PUBLIC_ROUTES: [string, string][] = [
  ["index.tsx", "/"],
  ["auth.tsx", "/auth"],
  ["auth_.callback.tsx", "/auth/callback"],
  ["privacy.tsx", "/privacy"],
  ["terms.tsx", "/terms"],
  ["support.tsx", "/support"],
  ["trades.tsx", "/trades"],
  ["gallery.tsx", "/gallery"],
  ["gallery.$slug.tsx", "/gallery/:slug"],
];

test("all public route files exist", () => {
  for (const [file, path] of PUBLIC_ROUTES) {
    assert.ok(routeExists(file), `Public route file for "${path}" is missing: src/routes/${file}`);
  }
});

// ── Authenticated routes ──────────────────────────────────────────────────────

const AUTHENTICATED_ROUTES: [string, string][] = [
  // Auth modernization: protected routes now live under the _authed pathless layout.
  // The generator strips the _authed prefix so public URLs are unchanged.
  ["_authed/dashboard.tsx", "/dashboard"],
  ["_authed/analyze.tsx", "/analyze"],
  ["_authed/studies.tsx", "/studies"],
  ["_authed/settings.tsx", "/settings"],
  ["_authed/admin.tsx", "/admin"],
  ["_authed/projects.new.tsx", "/projects/new"],
  ["_authed/projects.$id.index.tsx", "/projects/:id"],
  ["_authed/projects.$id.upload.tsx", "/projects/:id/upload"],
  ["_authed/projects.$id.estimate.tsx", "/projects/:id/estimate"],
  ["_authed/projects.$id.analysis.tsx", "/projects/:id/analysis"],
  ["_authed/projects.$id.report.tsx", "/projects/:id/report"],
  ["_authed/deal-copilot/index.tsx", "/deal-copilot"],
  ["_authed/deal-copilot/new.tsx", "/deal-copilot/new"],
  ["_authed/deal-copilot/$opportunityId.tsx", "/deal-copilot/:opportunityId"],
  ["_authed/deal-copilot/$opportunityId.edit.tsx", "/deal-copilot/:opportunityId/edit"],
  ["_authed/trades_.new.tsx", "/trades/new"],
  ["_authed/trades_.profile.tsx", "/trades/profile"],
  // trades_.$jobId.tsx (public job detail view) remains at root for unauthenticated marketplace visitors
  ["trades_.$jobId.tsx", "/trades/:jobId"],
  ["_authed/trades_.$jobId_.edit.tsx", "/trades/:jobId/edit"],
  ["_authed/marketplace.tsx", "/marketplace"],
];

test("all authenticated route files exist", () => {
  for (const [file, path] of AUTHENTICATED_ROUTES) {
    assert.ok(
      routeExists(file),
      `Authenticated route file for "${path}" is missing: src/routes/${file}`,
    );
  }
});

// ── Critical individual route checks ─────────────────────────────────────────

test("/auth/callback route file exists", () => {
  assert.ok(
    routeExists("auth_.callback.tsx"),
    "/auth/callback (auth_.callback.tsx) must exist — OAuth and PKCE depend on it",
  );
});

test("/dashboard route file exists", () => {
  assert.ok(
    routeExists("_authed/dashboard.tsx"),
    "/dashboard (_authed/dashboard.tsx) must exist after auth modernization",
  );
});

test("/trades/new route file exists", () => {
  assert.ok(
    routeExists("_authed/trades_.new.tsx"),
    "/trades/new (_authed/trades_.new.tsx) must exist — authenticated post-job flow (protected under _authed layout)",
  );
});

// ── Route protection classification ──────────────────────────────────────────

test("public routes do not use AppLayout (which wraps RequireAuth)", () => {
  for (const [file, path] of PUBLIC_ROUTES) {
    const source = readFileSync(join(ROUTES, file), "utf8");
    assert.ok(
      !source.includes("AppLayout"),
      `Public route "${path}" must not use AppLayout (it enforces RequireAuth).\n` +
        `File: src/routes/${file}`,
    );
  }
});

test("key authenticated routes use AppLayout", () => {
  // Spot-check a representative set of authenticated routes.
  const authenticated: [string, string][] = [
    ["_authed/dashboard.tsx", "/dashboard"],
    ["_authed/settings.tsx", "/settings"],
    ["_authed/projects.new.tsx", "/projects/new"],
    ["_authed/deal-copilot/index.tsx", "/deal-copilot"],
    ["_authed/trades_.new.tsx", "/trades/new"],
  ];

  for (const [file, path] of authenticated) {
    const source = readFileSync(join(ROUTES, file), "utf8");
    assert.ok(
      source.includes("AppLayout"),
      `Authenticated route "${path}" must use AppLayout.\nFile: src/routes/${file}`,
    );
  }
});

// ── Route documentation ───────────────────────────────────────────────────────

test("routes.md documentation file exists", () => {
  assert.ok(existsSync(ROUTES_DOC), "docs/architecture/routes.md must exist");
});

test("routes.md lists /trades as public", () => {
  const doc = readFileSync(ROUTES_DOC, "utf8");

  assert.ok(doc.includes("/trades"), "routes.md must mention /trades");
  // The doc must classify /trades as public (appears in the Public section)
  // We check for its presence in a public context by looking at the Public heading section.
  const publicSection = doc.split(/## Authenticated/i)[0];
  assert.ok(
    publicSection.includes("/trades"),
    "routes.md must list /trades in the Public routes section",
  );
});

test("routes.md lists /trades/new as authenticated", () => {
  const doc = readFileSync(ROUTES_DOC, "utf8");

  assert.ok(doc.includes("/trades/new"), "routes.md must mention /trades/new");
  // The /trades/new entry must appear in the Authenticated section.
  const authenticatedSection = doc.split(/## Authenticated/i)[1] ?? "";
  assert.ok(
    authenticatedSection.includes("/trades/new"),
    "routes.md must list /trades/new in the Authenticated routes section",
  );
});

test("routes.md mentions /auth/callback", () => {
  const doc = readFileSync(ROUTES_DOC, "utf8");

  assert.ok(doc.includes("/auth/callback"), "routes.md must document /auth/callback");
});

test("routes.md mentions /dashboard", () => {
  const doc = readFileSync(ROUTES_DOC, "utf8");

  assert.ok(doc.includes("/dashboard"), "routes.md must document /dashboard");
});

test("routes.md contains a do-not-change warning", () => {
  const doc = readFileSync(ROUTES_DOC, "utf8");

  assert.ok(
    doc.toLowerCase().includes("do not change") || doc.toLowerCase().includes("do-not-change"),
    "routes.md must include a do-not-change warning for route paths",
  );
});

test("routes.md notes /trades public vs /trades/new authenticated distinction", () => {
  const doc = readFileSync(ROUTES_DOC, "utf8");

  // Both must appear AND the distinction must be called out in text
  assert.ok(doc.includes("public"), "routes.md must use the word 'public'");
  assert.ok(
    doc.toLowerCase().includes("authenticated") || doc.toLowerCase().includes("auth"),
    "routes.md must use the word 'authenticated'",
  );
  assert.ok(
    doc.includes("/trades") && doc.includes("/trades/new"),
    "routes.md must mention both /trades and /trades/new to document the distinction",
  );
});

test("public gallery routes exist", () => {
  assert.ok(routeExists("gallery.tsx"), "Public gallery list route must exist");
  assert.ok(routeExists("gallery.$slug.tsx"), "Public gallery detail route must exist");
});

test("authenticated marketplace route exists", () => {
  assert.ok(routeExists("_authed/marketplace.tsx"), "Authenticated marketplace route must exist");
});
