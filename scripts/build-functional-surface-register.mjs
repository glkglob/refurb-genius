#!/usr/bin/env node
/**
 * P0-APP-AR2: Build canonical functional surface register JSON + Markdown.
 * Product behaviour is not modified. JSON is canonical; MD is generated.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const BASELINE = "b2041176bfbcc9aea83cffd69da8161884638deb";
const PHASE = "P0-APP-AR2";
const DATE = "2026-08-04";

const ALLOWED_STATUS = [
  "WORKING",
  "BROKEN",
  "PARTIAL",
  "INACCESSIBLE",
  "BLOCKED_CONFIGURATION",
  "BLOCKED_EXTERNAL",
  "INTENTIONALLY_HIDDEN",
  "NOT_TESTED",
];

/** @typedef {{ surfaceId:string, kind:"route"|"control"|"backend"|"integration", area:string, route:string, control:string, sourcePath:string, role:string, entitlement:string, preconditions:string[], operation:string, persistence:string, expectedResult:string, actualResult:string, status:string, severity:string, testReference:string|null, blocker:string|null, notes:string|null, authClass?:string, exposure?:string }} Surface */

/** @type {Surface[]} */
const surfaces = [];

function add(s) {
  surfaces.push({
    preconditions: s.preconditions ?? [],
    testReference: s.testReference ?? null,
    blocker: s.blocker ?? null,
    notes: s.notes ?? null,
    entitlement: s.entitlement ?? "none",
    ...s,
  });
}

function route(opts) {
  add({
    kind: "route",
    control: opts.control ?? "Page route",
    operation: opts.operation ?? "render route",
    persistence: opts.persistence ?? "none",
    expectedResult: opts.expectedResult ?? "Route loads with correct auth class",
    actualResult: opts.actualResult ?? "Static inventory only; runtime not verified",
    status: opts.status ?? "NOT_TESTED",
    severity: opts.severity ?? "P1",
    ...opts,
  });
}

function ctrl(opts) {
  add({
    kind: "control",
    operation: opts.operation ?? "user interaction",
    persistence: opts.persistence ?? "none",
    expectedResult:
      opts.expectedResult ?? "Control completes intended action or explains disablement",
    actualResult: opts.actualResult ?? "Static inventory only; runtime not verified",
    status: opts.status ?? "NOT_TESTED",
    severity: opts.severity ?? "P1",
    ...opts,
  });
}

function be(opts) {
  add({
    kind: "backend",
    route: opts.route ?? "server",
    control: opts.control ?? opts.surfaceId,
    role: opts.role ?? "authenticated",
    operation: opts.operation ?? "server operation",
    persistence: opts.persistence ?? "database",
    expectedResult: opts.expectedResult ?? "Operation succeeds with auth and ownership",
    actualResult: opts.actualResult ?? "Static inventory only; runtime not verified",
    status: opts.status ?? "NOT_TESTED",
    severity: opts.severity ?? "P1",
    ...opts,
  });
}

function integ(opts) {
  add({
    kind: "integration",
    route: opts.route ?? "env",
    control: opts.control ?? opts.surfaceId,
    role: opts.role ?? "system",
    operation: opts.operation ?? "external integration",
    persistence: opts.persistence ?? "provider",
    expectedResult: opts.expectedResult ?? "Integration available when configured",
    actualResult: opts.actualResult ?? "Deferred env classification to P0-APP-B",
    status: opts.status ?? "NOT_TESTED",
    severity: opts.severity ?? "P1",
    exposure: opts.exposure ?? "production-visible",
    ...opts,
  });
}

// ---------------------------------------------------------------------------
// ROUTES (must match routeTree.gen.ts fullPaths + source files)
// ---------------------------------------------------------------------------
const ROUTES = [
  {
    surfaceId: "route.public.home",
    area: "public",
    route: "/",
    sourcePath: "src/routes/index.tsx",
    role: "public",
    authClass: "public",
    severity: "P1",
  },
  {
    surfaceId: "route.auth",
    area: "authentication",
    route: "/auth",
    sourcePath: "src/routes/auth.tsx",
    role: "public",
    authClass: "public",
    severity: "P0",
    status: "PARTIAL",
    actualResult: "Unit tests for AuthExperience; E2E not verified",
    testReference: "src/features/auth/presentation/AuthExperience.test.tsx",
  },
  {
    surfaceId: "route.auth.callback",
    area: "authentication",
    route: "/auth/callback",
    sourcePath: "src/routes/auth_.callback.tsx",
    role: "public",
    authClass: "public",
    severity: "P0",
    testReference: "src/features/auth/presentation/hooks/useAuthCallbackCompletion.test.ts",
  },
  {
    surfaceId: "route.oauth.consent",
    area: "authentication",
    route: "/oauth/consent",
    sourcePath: "src/routes/oauth.consent.tsx",
    role: "public",
    authClass: "public",
    severity: "P2",
  },
  {
    surfaceId: "route.privacy",
    area: "public",
    route: "/privacy",
    sourcePath: "src/routes/privacy.tsx",
    role: "public",
    authClass: "public",
    severity: "P2",
  },
  {
    surfaceId: "route.terms",
    area: "public",
    route: "/terms",
    sourcePath: "src/routes/terms.tsx",
    role: "public",
    authClass: "public",
    severity: "P2",
  },
  {
    surfaceId: "route.support",
    area: "public",
    route: "/support",
    sourcePath: "src/routes/support.tsx",
    role: "public",
    authClass: "public",
    severity: "P2",
    status: "PARTIAL",
    actualResult: "Some FAQ answers state coming soon",
    blocker: "content-accuracy",
  },
  {
    surfaceId: "route.gallery.list",
    area: "gallery",
    route: "/gallery",
    sourcePath: "src/routes/gallery.tsx",
    role: "public",
    authClass: "public",
    severity: "P1",
  },
  {
    surfaceId: "route.gallery.detail",
    area: "gallery",
    route: "/gallery/$slug",
    sourcePath: "src/routes/gallery.$slug.tsx",
    role: "public",
    authClass: "public",
    severity: "P1",
  },
  {
    surfaceId: "route.trades.public",
    area: "trades",
    route: "/trades",
    sourcePath: "src/routes/trades.tsx",
    role: "public",
    authClass: "public",
    severity: "P1",
    status: "PARTIAL",
    actualResult: "Coming soon banner while marketplace flows exist",
    blocker: "messaging-vs-functionality",
  },
  {
    surfaceId: "route.trades.job-detail",
    area: "trades",
    route: "/trades/$jobId",
    sourcePath: "src/routes/trades_.$jobId.tsx",
    role: "mixed",
    authClass: "public",
    severity: "P1",
  },
  {
    surfaceId: "route.dashboard",
    area: "dashboard",
    route: "/dashboard",
    sourcePath: "src/routes/_authed/dashboard.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P0",
    testReference: "src/routes/_authed/-dashboard.test.tsx",
  },
  {
    surfaceId: "route.analyze",
    area: "projects",
    route: "/analyze",
    sourcePath: "src/routes/_authed/analyze.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P0",
    notes:
      "IA-7-R1: canonical New Analysis entry — durable project create → /projects/$id/upload. Shared NewProjectEntry with /projects/new alias.",
    testReference: "src/routes/_authed/-projects.index.ia7.test.ts",
  },
  {
    surfaceId: "route.studies.list",
    area: "studies",
    route: "/studies",
    sourcePath: "src/routes/_authed/studies.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P0",
  },
  {
    surfaceId: "route.studies.detail",
    area: "studies",
    route: "/studies/$id",
    sourcePath: "src/routes/_authed/studies.$id.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P0",
  },
  {
    surfaceId: "route.studies.workspace",
    area: "studies",
    route: "/studies/workspace",
    sourcePath: "src/routes/_authed/studies_.workspace.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P1",
    notes:
      "IA-7-R1: demoted guided feasibility workspace (relocated from /analyze). Compatibility deep links only; not primary global nav.",
    testReference: "src/routes/_authed/-studies_.workspace.photo-upload.test.tsx",
  },
  {
    surfaceId: "route.projects.list",
    area: "projects",
    route: "/projects",
    sourcePath: "src/routes/_authed/projects.index.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P0",
    notes: "IA-7 canonical Projects browse surface",
    testReference: "src/routes/_authed/-projects.index.ia7.test.ts",
  },
  {
    surfaceId: "route.projects.new",
    area: "projects",
    route: "/projects/new",
    sourcePath: "src/routes/_authed/projects.new.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P0",
    notes: "IA-7-R1: compatibility alias of /analyze New Analysis entry (shared NewProjectEntry).",
  },
  {
    surfaceId: "route.projects.detail",
    area: "projects",
    route: "/projects/$id",
    sourcePath: "src/routes/_authed/projects.$id.index.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P0",
  },
  {
    surfaceId: "route.projects.upload",
    area: "photos",
    route: "/projects/$id/upload",
    sourcePath: "src/routes/_authed/projects.$id.upload.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P0",
    status: "PARTIAL",
    actualResult: "Camera single-file semantics present in code; runtime not verified",
    blocker: "runtime-browser-verification",
  },
  {
    surfaceId: "route.projects.analysis",
    area: "feasibility",
    route: "/projects/$id/analysis",
    sourcePath: "src/routes/_authed/projects.$id.analysis.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P0",
  },
  {
    surfaceId: "route.projects.redesign",
    area: "feasibility",
    route: "/projects/$id/redesign",
    sourcePath: "src/routes/_authed/projects.$id.redesign.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P0",
    status: "NOT_TESTED",
    notes: "IA-4 first-class Redesign stage",
  },
  {
    surfaceId: "route.projects.scope",
    area: "feasibility",
    route: "/projects/$id/scope",
    sourcePath: "src/routes/_authed/projects.$id.scope.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P0",
  },
  {
    surfaceId: "route.projects.estimate",
    area: "estimate",
    route: "/projects/$id/estimate",
    sourcePath: "src/routes/_authed/projects.$id.estimate.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P0",
  },
  {
    surfaceId: "route.projects.report",
    area: "export",
    route: "/projects/$id/report",
    sourcePath: "src/routes/_authed/projects.$id.report.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P0",
  },
  {
    surfaceId: "route.estimate.instant",
    area: "estimate",
    route: "/estimate/instant",
    sourcePath: "src/routes/_authed/estimate.instant.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P0",
    status: "PARTIAL",
    testReference: "src/features/estimate/presentation/components/L1EstimateForm.test.tsx",
    actualResult: "L1 form unit tests; E2E not verified",
    blocker: "e2e-instant-estimate",
  },
  {
    surfaceId: "route.settings",
    area: "settings",
    route: "/settings",
    sourcePath: "src/routes/_authed/settings.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P1",
    status: "BROKEN",
    actualResult: "Save does not persist full name; false success toast",
    blocker: "profile-update-missing",
  },
  {
    surfaceId: "route.admin",
    area: "administration",
    route: "/admin",
    sourcePath: "src/routes/_authed/admin.tsx",
    role: "admin",
    authClass: "admin",
    severity: "P1",
    status: "NOT_TESTED",
    notes:
      "Reachable by URL; not in primary Sidebar. Access gate unprobed — not INTENTIONALLY_HIDDEN for the route itself.",
    testReference: "src/routes/_authed/-admin.test.tsx",
  },
  {
    surfaceId: "route.marketplace",
    area: "marketplace",
    route: "/marketplace",
    sourcePath: "src/routes/_authed/marketplace.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P1",
  },
  {
    surfaceId: "route.deal-copilot.index",
    area: "deal-copilot",
    route: "/deal-copilot",
    sourcePath: "src/routes/_authed/deal-copilot/index.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P1",
  },
  {
    surfaceId: "route.deal-copilot.new",
    area: "deal-copilot",
    route: "/deal-copilot/new",
    sourcePath: "src/routes/_authed/deal-copilot/new.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P1",
  },
  {
    surfaceId: "route.deal-copilot.detail",
    area: "deal-copilot",
    route: "/deal-copilot/$opportunityId",
    sourcePath: "src/routes/_authed/deal-copilot/$opportunityId.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P1",
  },
  {
    surfaceId: "route.deal-copilot.edit",
    area: "deal-copilot",
    route: "/deal-copilot/$opportunityId/edit",
    sourcePath: "src/routes/_authed/deal-copilot/$opportunityId.edit.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P1",
  },
  {
    surfaceId: "route.trades.new",
    area: "trades",
    route: "/trades/new",
    sourcePath: "src/routes/_authed/trades_.new.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P1",
  },
  {
    surfaceId: "route.trades.edit",
    area: "trades",
    route: "/trades/$jobId/edit",
    sourcePath: "src/routes/_authed/trades_.$jobId_.edit.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P1",
  },
  {
    surfaceId: "route.trades.profile",
    area: "trades",
    route: "/trades/profile",
    sourcePath: "src/routes/_authed/trades_.profile.tsx",
    role: "authenticated",
    authClass: "authenticated",
    severity: "P1",
  },
];

for (const r of ROUTES) {
  route({
    ...r,
    control: `Route ${r.route}`,
    operation: `Render and serve ${r.route}`,
  });
}

// Pathless layout gate (not a fullPath page, but operational surface)
route({
  surfaceId: "route.authed.layout-gate",
  area: "authentication",
  route: "/_authed",
  sourcePath: "src/routes/_authed.tsx",
  role: "authenticated",
  authClass: "authenticated",
  control: "beforeLoad auth gate",
  operation: "getCurrentUserServerFn; redirect unauthenticated to /auth",
  severity: "P0",
  notes: "Pathless layout; registered for gate completeness. Not a public fullPath.",
});

// ---------------------------------------------------------------------------
// CONTROLS — Authentication
// ---------------------------------------------------------------------------
const AUTH_SRC = "src/features/auth/presentation/AuthExperience.tsx";
ctrl({
  surfaceId: "ctrl.auth.mode.signin",
  area: "authentication",
  route: "/auth",
  control: "Mode switch: Sign in",
  sourcePath: AUTH_SRC,
  role: "public",
  operation: "switchMode(signin)",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.auth.mode.signup",
  area: "authentication",
  route: "/auth",
  control: "Mode switch: Sign up",
  sourcePath: AUTH_SRC,
  role: "public",
  operation: "switchMode(signup)",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.auth.header-mode-toggle",
  area: "authentication",
  route: "/auth",
  control: "Header Sign in/Sign up toggle",
  sourcePath: AUTH_SRC,
  role: "public",
  operation: "navigate mode search param",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.auth.signin-submit",
  area: "authentication",
  route: "/auth",
  control: "Sign in form submit",
  sourcePath: AUTH_SRC,
  role: "public",
  operation: "signInWithPassword",
  persistence: "session",
  severity: "P0",
  testReference: "src/features/auth/presentation/hooks/useAuthPasswordCredentials.test.ts",
});
ctrl({
  surfaceId: "ctrl.auth.signup-submit",
  area: "authentication",
  route: "/auth",
  control: "Sign up form submit",
  sourcePath: AUTH_SRC,
  role: "public",
  operation: "signUpWithPassword",
  persistence: "auth user + profile",
  severity: "P0",
  testReference: "src/features/auth/presentation/AuthExperience.test.tsx",
});
ctrl({
  surfaceId: "ctrl.auth.terms-checkbox",
  area: "authentication",
  route: "/auth",
  control: "Terms consent checkbox",
  sourcePath: AUTH_SRC,
  role: "public",
  operation: "gate signup submit",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.auth.terms-link",
  area: "authentication",
  route: "/auth",
  control: "Terms link",
  sourcePath: AUTH_SRC,
  role: "public",
  operation: "open /terms",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.auth.privacy-link",
  area: "authentication",
  route: "/auth",
  control: "Privacy link",
  sourcePath: AUTH_SRC,
  role: "public",
  operation: "open /privacy",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.auth.forgot-password",
  area: "authentication",
  route: "/auth",
  control: "Forgot password request",
  sourcePath: AUTH_SRC,
  role: "public",
  operation: "password reset email",
  persistence: "auth email",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.auth.magic-link",
  area: "authentication",
  route: "/auth",
  control: "Continue with magic link",
  sourcePath: AUTH_SRC,
  role: "public",
  operation: "handleMagicLink → useAuthEmailAccess.sendMagicLink → sendMagicLinkEmail",
  persistence: "Supabase Auth OTP email + callback session",
  expectedResult: "Magic link email sent; user completes sign-in via /auth/callback",
  actualResult: "Unit tests for useAuthEmailAccess and AuthExperience magic-link; E2E not verified",
  status: "PARTIAL",
  severity: "P0",
  testReference: "src/features/auth/presentation/hooks/useAuthEmailAccess.test.ts",
  notes:
    "Visible label alternates to 'Sending magic link...' while loading; requires non-empty email",
});
ctrl({
  surfaceId: "ctrl.auth.reset-submit",
  area: "authentication",
  route: "/auth",
  control: "Password reset mode submit",
  sourcePath: AUTH_SRC,
  role: "public",
  operation: "reset password flow",
  severity: "P1",
  notes: "mode=reset in AuthExperience",
});
ctrl({
  surfaceId: "ctrl.auth.show-password",
  area: "authentication",
  route: "/auth",
  control: "Toggle password visibility",
  sourcePath: AUTH_SRC,
  role: "public",
  operation: "UI toggle",
  severity: "P3",
});
ctrl({
  surfaceId: "ctrl.auth.show-confirm-password",
  area: "authentication",
  route: "/auth",
  control: "Toggle confirm password visibility",
  sourcePath: AUTH_SRC,
  role: "public",
  operation: "UI toggle",
  severity: "P3",
});
ctrl({
  surfaceId: "ctrl.auth.oauth.google",
  area: "authentication",
  route: "/auth",
  control: "Continue with Google",
  sourcePath: AUTH_SRC,
  role: "public",
  operation: "startGoogleOAuth",
  severity: "P0",
  testReference: "src/features/auth/presentation/hooks/useOAuthSignIn.test.ts",
});
ctrl({
  surfaceId: "ctrl.auth.oauth.apple",
  area: "authentication",
  route: "/auth",
  control: "Continue with Apple",
  sourcePath: AUTH_SRC,
  role: "public",
  operation: "startAppleOAuth",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.auth.oauth.github",
  area: "authentication",
  route: "/auth",
  control: "Continue with GitHub",
  sourcePath: AUTH_SRC,
  role: "public",
  operation: "startGitHubOAuth",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.auth.callback.recovery",
  area: "authentication",
  route: "/auth/callback",
  control: "Callback error recovery link to /auth",
  sourcePath: "src/routes/auth_.callback.tsx",
  role: "public",
  operation: "navigate /auth",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.auth.signout",
  area: "authentication",
  route: "*",
  control: "Sidebar logout",
  sourcePath: "src/components/Sidebar.tsx",
  role: "authenticated",
  operation: "useSignOut → /",
  persistence: "session clear",
  severity: "P0",
  testReference: "src/features/auth/presentation/hooks/useSignOut.test.ts",
});
ctrl({
  surfaceId: "ctrl.oauth.consent.signin",
  area: "authentication",
  route: "/oauth/consent",
  control: "Consent page Sign in",
  sourcePath: "src/routes/oauth.consent.tsx",
  role: "public",
  operation: "Link /auth signin",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.oauth.consent.home",
  area: "authentication",
  route: "/oauth/consent",
  control: "Consent page Home",
  sourcePath: "src/routes/oauth.consent.tsx",
  role: "public",
  operation: "Link /",
  severity: "P3",
});

// ---------------------------------------------------------------------------
// CONTROLS — Navigation / public
// ---------------------------------------------------------------------------
ctrl({
  surfaceId: "ctrl.nav.sidebar.dashboard",
  area: "navigation",
  route: "*",
  control: "Sidebar → Dashboard",
  sourcePath: "src/components/Sidebar.tsx",
  role: "authenticated",
  operation: "Link /dashboard",
  severity: "P0",
  testReference: "src/components/Sidebar.test.tsx",
});
ctrl({
  surfaceId: "ctrl.nav.sidebar.analyze",
  area: "navigation",
  route: "*",
  control: "Sidebar → New Study",
  sourcePath: "src/components/Sidebar.tsx",
  role: "authenticated",
  operation: "Link /analyze",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.nav.sidebar.studies",
  area: "navigation",
  route: "*",
  control: "Sidebar → Studies",
  sourcePath: "src/components/Sidebar.tsx",
  role: "authenticated",
  operation: "Link /studies",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.nav.sidebar.deal-copilot",
  area: "navigation",
  route: "*",
  control: "Sidebar → Deal Copilot",
  sourcePath: "src/components/Sidebar.tsx",
  role: "authenticated",
  operation: "Link /deal-copilot",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.nav.sidebar.trades",
  area: "navigation",
  route: "*",
  control: "Sidebar → Trades",
  sourcePath: "src/components/Sidebar.tsx",
  role: "authenticated",
  operation: "Link /trades",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.nav.sidebar.settings",
  area: "navigation",
  route: "*",
  control: "Sidebar → Settings",
  sourcePath: "src/components/Sidebar.tsx",
  role: "authenticated",
  operation: "Link /settings",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.nav.sidebar.admin-absent",
  area: "navigation",
  route: "*",
  control: "Admin link in primary Sidebar",
  sourcePath: "src/components/Sidebar.tsx",
  role: "authenticated",
  operation: "none — not rendered",
  status: "INTENTIONALLY_HIDDEN",
  severity: "P2",
  notes: "Admin route exists but is not a Sidebar item",
});
ctrl({
  surfaceId: "ctrl.nav.navbar.dashboard",
  area: "navigation",
  route: "public",
  control: "Navbar Dashboard",
  sourcePath: "src/components/Navbar.tsx",
  role: "mixed",
  operation: "Link /dashboard",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.nav.navbar.deal-copilot",
  area: "navigation",
  route: "public",
  control: "Navbar Deal Copilot",
  sourcePath: "src/components/Navbar.tsx",
  role: "mixed",
  operation: "Link /deal-copilot",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.nav.navbar.trades",
  area: "navigation",
  route: "public",
  control: "Navbar Trades",
  sourcePath: "src/components/Navbar.tsx",
  role: "mixed",
  operation: "Link /trades",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.nav.navbar.post-job",
  area: "navigation",
  route: "public",
  control: "Navbar Post Job",
  sourcePath: "src/components/Navbar.tsx",
  role: "mixed",
  operation: "Link /trades/new",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.nav.navbar.signin",
  area: "navigation",
  route: "public",
  control: "Navbar Sign in",
  sourcePath: "src/components/Navbar.tsx",
  role: "public",
  operation: "Link /auth signin",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.nav.navbar.signup",
  area: "navigation",
  route: "public",
  control: "Navbar Get started free",
  sourcePath: "src/components/Navbar.tsx",
  role: "public",
  operation: "Link /auth signup",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.nav.navbar.mobile-menu",
  area: "navigation",
  route: "public",
  control: "Mobile hamburger toggle",
  sourcePath: "src/components/Navbar.tsx",
  role: "mixed",
  operation: "toggle menuOpen",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.nav.footer.privacy",
  area: "navigation",
  route: "*",
  control: "Footer Data Privacy",
  sourcePath: "src/components/Footer.tsx",
  role: "public",
  operation: "Link /privacy",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.nav.footer.terms",
  area: "navigation",
  route: "*",
  control: "Footer Terms",
  sourcePath: "src/components/Footer.tsx",
  role: "public",
  operation: "Link /terms",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.nav.mobile-topbar.home",
  area: "navigation",
  route: "*",
  control: "Mobile top bar logo home",
  sourcePath: "src/components/MobileTopBar.tsx",
  role: "mixed",
  operation: "navigate /",
  severity: "P2",
  testReference: "src/components/MobileTopBar.test.tsx",
});
ctrl({
  surfaceId: "ctrl.nav.theme-toggle",
  area: "navigation",
  route: "*",
  control: "ThemeToggle",
  sourcePath: "src/components/ThemeToggle.tsx",
  role: "mixed",
  operation: "toggle theme",
  severity: "P3",
});
ctrl({
  surfaceId: "ctrl.nav.platform.dashboard",
  area: "navigation",
  route: "*",
  control: "PlatformNav Dashboard",
  sourcePath: "src/components/PlatformNavButtons.tsx",
  role: "authenticated",
  operation: "Link /dashboard",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.nav.platform.deal-copilot",
  area: "navigation",
  route: "*",
  control: "PlatformNav Deal Copilot",
  sourcePath: "src/components/PlatformNavButtons.tsx",
  role: "authenticated",
  operation: "Link /deal-copilot",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.nav.platform.trades",
  area: "navigation",
  route: "*",
  control: "PlatformNav Trades",
  sourcePath: "src/components/PlatformNavButtons.tsx",
  role: "authenticated",
  operation: "Link /trades",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.nav.platform.post-job",
  area: "navigation",
  route: "*",
  control: "PlatformNav Post Job",
  sourcePath: "src/components/PlatformNavButtons.tsx",
  role: "authenticated",
  operation: "Link /trades/new",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.public.home.cta-auth",
  area: "public",
  route: "/",
  control: "Landing primary auth CTA",
  sourcePath: "src/routes/index.tsx",
  role: "public",
  operation: "Link /auth",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.public.home.workflow-anchor",
  area: "public",
  route: "/",
  control: "Workflow section anchor",
  sourcePath: "src/routes/index.tsx",
  role: "public",
  operation: "href #workflow",
  severity: "P3",
});
ctrl({
  surfaceId: "ctrl.public.support.mailto",
  area: "public",
  route: "/support",
  control: "support@ mailto",
  sourcePath: "src/routes/support.tsx",
  role: "public",
  operation: "mailto:support@refurbgenius.co.uk",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.public.privacy.mailto",
  area: "public",
  route: "/privacy",
  control: "privacy support mailto",
  sourcePath: "src/routes/privacy.tsx",
  role: "public",
  operation: "mailto",
  severity: "P3",
});
ctrl({
  surfaceId: "ctrl.root.error-reset",
  area: "public",
  route: "*",
  control: "Root error boundary reset",
  sourcePath: "src/routes/__root.tsx",
  role: "public",
  operation: "handleReset",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.root.error-home",
  area: "public",
  route: "*",
  control: "Root error boundary home link",
  sourcePath: "src/routes/__root.tsx",
  role: "public",
  operation: "href /",
  severity: "P2",
});

// ---------------------------------------------------------------------------
// CONTROLS — Dashboard
// ---------------------------------------------------------------------------
const DASH = "src/routes/_authed/dashboard.tsx";
ctrl({
  surfaceId: "ctrl.dashboard.onboarding-goal",
  area: "dashboard",
  route: "/dashboard",
  control: "Onboarding goal select",
  sourcePath: DASH,
  role: "authenticated",
  operation: "useOnboardingGoalSelection",
  persistence: "user goal metadata",
  severity: "P2",
  status: "PARTIAL",
  testReference: "src/routes/_authed/-dashboard.test.tsx",
  actualResult: "Unit-tested hydrate/apply",
  blocker: "e2e-onboarding",
});
ctrl({
  surfaceId: "ctrl.dashboard.onboarding-dismiss",
  area: "dashboard",
  route: "/dashboard",
  control: "Dismiss onboarding card",
  sourcePath: DASH,
  role: "authenticated",
  operation: "setShowOnboardingCard(false)",
  severity: "P3",
});
ctrl({
  surfaceId: "ctrl.dashboard.start-study",
  area: "dashboard",
  route: "/dashboard",
  control: "Start first study",
  sourcePath: DASH,
  role: "authenticated",
  operation: "Link /analyze",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.dashboard.create-project",
  area: "dashboard",
  route: "/dashboard",
  control: "Create project CTA",
  sourcePath: DASH,
  role: "authenticated",
  operation: "Link /projects/new",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.dashboard.empty-create-project",
  area: "dashboard",
  route: "/dashboard",
  control: "Empty projects Create project",
  sourcePath: DASH,
  role: "authenticated",
  operation: "Link /projects/new",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.dashboard.quick.instant-estimate",
  area: "dashboard",
  route: "/dashboard",
  control: "Quick action Instant Estimate",
  sourcePath: DASH,
  role: "authenticated",
  operation: "Link /estimate/instant",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.dashboard.quick.post-job",
  area: "dashboard",
  route: "/dashboard",
  control: "Quick action Post a Trades Job",
  sourcePath: DASH,
  role: "authenticated",
  operation: "Link /trades/new",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.dashboard.quick.studies",
  area: "dashboard",
  route: "/dashboard",
  control: "Quick action Saved Studies",
  sourcePath: DASH,
  role: "authenticated",
  operation: "Link /studies",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.dashboard.quick.create-project",
  area: "dashboard",
  route: "/dashboard",
  control: "Quick action Create Project",
  sourcePath: DASH,
  role: "authenticated",
  operation: "Link /projects/new",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.dashboard.section.post-job",
  area: "dashboard",
  route: "/dashboard",
  control: "My trades + Post new job",
  sourcePath: DASH,
  role: "authenticated",
  operation: "Link /trades/new",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.dashboard.job.view",
  area: "dashboard",
  route: "/dashboard",
  control: "Job row View",
  sourcePath: DASH,
  role: "authenticated",
  operation: "Link /trades/$jobId",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.dashboard.job.edit",
  area: "dashboard",
  route: "/dashboard",
  control: "Job row Edit",
  sourcePath: DASH,
  role: "authenticated",
  operation: "Link /trades/$jobId/edit",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.dashboard.job.close",
  area: "dashboard",
  route: "/dashboard",
  control: "Job row Close job",
  sourcePath: DASH,
  role: "authenticated",
  operation: "close job mutation",
  persistence: "job status",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.dashboard.interest.view-job",
  area: "dashboard",
  route: "/dashboard",
  control: "Interest View job",
  sourcePath: DASH,
  role: "authenticated",
  operation: "Link /trades/$jobId",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.dashboard.project.open",
  area: "dashboard",
  route: "/dashboard",
  control: "Project card open",
  sourcePath: DASH,
  role: "authenticated",
  operation: "Link /projects/$id",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.dashboard.roi-cta",
  area: "dashboard",
  route: "/dashboard",
  control: "Run Full ROI Analysis card",
  sourcePath: DASH,
  role: "authenticated",
  operation: "navigate analyze/projects",
  severity: "P1",
});

// ---------------------------------------------------------------------------
// CONTROLS — Projects
// ---------------------------------------------------------------------------
ctrl({
  surfaceId: "ctrl.projects.new.submit",
  area: "projects",
  route: "/projects/new",
  control: "Create & continue",
  sourcePath: "src/routes/_authed/projects.new.tsx",
  role: "authenticated",
  operation: "createProjectServerFn via useCreateProject",
  persistence: "projects",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.projects.new.cancel",
  area: "projects",
  route: "/projects/new",
  control: "Cancel",
  sourcePath: "src/routes/_authed/projects.new.tsx",
  role: "authenticated",
  operation: "navigate /dashboard",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.projects.new.region",
  area: "projects",
  route: "/projects/new",
  control: "Region select",
  sourcePath: "src/routes/_authed/projects.new.tsx",
  role: "authenticated",
  operation: "form field",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.projects.new.property-type",
  area: "projects",
  route: "/projects/new",
  control: "Property type select",
  sourcePath: "src/routes/_authed/projects.new.tsx",
  role: "authenticated",
  operation: "form field",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.projects.detail.tab.overview",
  area: "projects",
  route: "/projects/$id",
  control: "Tab overview",
  sourcePath: "src/routes/_authed/projects.$id.index.tsx",
  role: "authenticated",
  operation: "search tab",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.projects.detail.pipeline.upload",
  area: "projects",
  route: "/projects/$id",
  control: "Pipeline → Upload",
  sourcePath: "src/routes/_authed/projects.$id.index.tsx",
  role: "authenticated",
  operation: "Link /projects/$id/upload",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.projects.detail.pipeline.analysis",
  area: "projects",
  route: "/projects/$id",
  control: "Pipeline → Analysis",
  sourcePath: "src/routes/_authed/projects.$id.index.tsx",
  role: "authenticated",
  operation: "Link /projects/$id/analysis",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.projects.detail.pipeline.estimate",
  area: "projects",
  route: "/projects/$id",
  control: "Pipeline → Estimate",
  sourcePath: "src/routes/_authed/projects.$id.index.tsx",
  role: "authenticated",
  operation: "Link /projects/$id/estimate",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.projects.detail.pipeline.report",
  area: "projects",
  route: "/projects/$id",
  control: "Pipeline → Report",
  sourcePath: "src/routes/_authed/projects.$id.index.tsx",
  role: "authenticated",
  operation: "Link /projects/$id/report",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.projects.detail.saved-studies",
  area: "projects",
  route: "/projects/$id",
  control: "Saved studies link",
  sourcePath: "src/routes/_authed/projects.$id.index.tsx",
  role: "authenticated",
  operation: "Link /studies",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.projects.detail.bulk-upload",
  area: "projects",
  route: "/projects/$id",
  control: "BulkPhotoUpload zone",
  sourcePath: "src/components/BulkPhotoUpload.tsx",
  role: "authenticated",
  operation: "multi file upload",
  persistence: "photos",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.projects.detail.publish-gallery",
  area: "projects",
  route: "/projects/$id",
  control: "PublishToGallery open/submit",
  sourcePath: "src/components/gallery/PublishToGallery.tsx",
  role: "authenticated",
  operation: "publish gallery + optional image",
  persistence: "gallery",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.projects.detail.publish-file",
  area: "gallery",
  route: "/projects/$id",
  control: "PublishToGallery file input",
  sourcePath: "src/components/gallery/PublishToGallery.tsx",
  role: "authenticated",
  operation: "type=file image",
  severity: "P2",
});

// ---------------------------------------------------------------------------
// CONTROLS — Photos / analyze / upload
// ---------------------------------------------------------------------------
const ZONE = "src/features/ai-upload/presentation/components/PhotoUploadZone.tsx";
// IA-7-R1: guided feasibility workspace relocated from /analyze → /studies/workspace.
// Surface IDs retain ctrl.analyze.* for inventory continuity.
const FEASIBILITY_WORKSPACE = "src/routes/_authed/studies_.workspace.tsx";
const UPLOAD = "src/routes/_authed/projects.$id.upload.tsx";

ctrl({
  surfaceId: "ctrl.analyze.project-select",
  area: "feasibility",
  route: "/studies/workspace",
  control: "Project free-text + datalist",
  sourcePath: FEASIBILITY_WORKSPACE,
  role: "authenticated",
  operation: "set search.projectId raw text",
  status: "BROKEN",
  severity: "P0",
  blocker: "free-text-project-id",
  actualResult: "Unresolved free-text values possible",
});
ctrl({
  surfaceId: "ctrl.analyze.photo.take",
  area: "photos",
  route: "/studies/workspace",
  control: "Take Photo",
  sourcePath: ZONE,
  role: "authenticated",
  operation: "trigger camera input",
  status: "BROKEN",
  severity: "P0",
  blocker: "isLoading-gated-on-project",
  actualResult: "Disabled when !selectedProject via isLoading",
});
ctrl({
  surfaceId: "ctrl.analyze.photo.library",
  area: "photos",
  route: "/studies/workspace",
  control: "Upload from Library",
  sourcePath: ZONE,
  role: "authenticated",
  operation: "trigger library input",
  status: "BROKEN",
  severity: "P0",
  blocker: "isLoading-gated-on-project",
  actualResult: "Disabled when no project",
});
ctrl({
  surfaceId: "ctrl.analyze.photo.camera-input",
  area: "photos",
  route: "/studies/workspace",
  control: "Hidden camera input",
  sourcePath: ZONE,
  role: "authenticated",
  operation: "type=file capture=environment",
  status: "BROKEN",
  severity: "P0",
  blocker: "camera-multiple-attribute",
  actualResult: "Has multiple=true incorrectly",
});
ctrl({
  surfaceId: "ctrl.analyze.photo.library-input",
  area: "photos",
  route: "/studies/workspace",
  control: "Hidden library input",
  sourcePath: ZONE,
  role: "authenticated",
  operation: "type=file multiple",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.analyze.photo.remove",
  area: "photos",
  route: "/studies/workspace",
  control: "Remove selected photo",
  sourcePath: ZONE,
  role: "authenticated",
  operation: "removePhoto(index)",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.analyze.photo.clear",
  area: "photos",
  route: "/studies/workspace",
  control: "Clear selection",
  sourcePath: ZONE,
  role: "authenticated",
  operation: "setPhotos([])",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.analyze.upload-selected",
  area: "photos",
  route: "/studies/workspace",
  control: "Upload Selected",
  sourcePath: FEASIBILITY_WORKSPACE,
  role: "authenticated",
  operation: "useUploadPhotos",
  persistence: "storage+metadata",
  status: "PARTIAL",
  severity: "P0",
  blocker: "analyze-upload-ux",
  actualResult: "Disabled without project; thin error UX",
  testReference: "src/features/ai-upload/presentation/hooks/usePhotos.test.ts",
});
ctrl({
  surfaceId: "ctrl.analyze.run-full",
  area: "feasibility",
  route: "/studies/workspace",
  control: "Run Full Analysis",
  sourcePath: FEASIBILITY_WORKSPACE,
  role: "authenticated",
  operation: "orchestrator full run",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.analyze.stage.click",
  area: "feasibility",
  route: "/studies/workspace",
  control: "Guided stage checklist item click",
  sourcePath: FEASIBILITY_WORKSPACE,
  role: "authenticated",
  operation: "orchestrator.setStage",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.analyze.retry-stage",
  area: "feasibility",
  route: "/studies/workspace",
  control: "Retry stage",
  sourcePath: FEASIBILITY_WORKSPACE,
  role: "authenticated",
  operation: "retryFromLastSuccessful",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.analyze.continue-stage",
  area: "feasibility",
  route: "/studies/workspace",
  control: "Continue from last success",
  sourcePath: FEASIBILITY_WORKSPACE,
  role: "authenticated",
  operation: "continueFromCurrentStage",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.analyze.queue-export",
  area: "export",
  route: "/studies/workspace",
  control: "Queue Investor Export",
  sourcePath: FEASIBILITY_WORKSPACE,
  role: "authenticated",
  operation: "useQueueFeasibilityExport",
  persistence: "export queue",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.analyze.export-report",
  area: "export",
  route: "/studies/workspace",
  control: "Export feasibility report",
  sourcePath: FEASIBILITY_WORKSPACE,
  role: "authenticated",
  operation: "useExportFeasibilityReport",
  entitlement: "hasProAccess may apply",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.analyze.open-study",
  area: "studies",
  route: "/studies/workspace",
  control: "Open study dashboard link",
  sourcePath: FEASIBILITY_WORKSPACE,
  role: "authenticated",
  operation: "a href /studies/$id",
  severity: "P1",
});

ctrl({
  surfaceId: "ctrl.upload.camera",
  area: "photos",
  route: "/projects/$id/upload",
  control: "Take Photo",
  sourcePath: UPLOAD,
  role: "authenticated",
  operation: "camera input single-file",
  severity: "P0",
  notes: "Physical device manual QA required",
});
ctrl({
  surfaceId: "ctrl.upload.library",
  area: "photos",
  route: "/projects/$id/upload",
  control: "Choose Files",
  sourcePath: UPLOAD,
  role: "authenticated",
  operation: "library multi input",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.upload.camera-input",
  area: "photos",
  route: "/projects/$id/upload",
  control: "Hidden camera input",
  sourcePath: UPLOAD,
  role: "authenticated",
  operation: "capture=environment no multiple",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.upload.library-input",
  area: "photos",
  route: "/projects/$id/upload",
  control: "Hidden library input",
  sourcePath: UPLOAD,
  role: "authenticated",
  operation: "multiple",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.upload.remove-photo",
  area: "photos",
  route: "/projects/$id/upload",
  control: "Remove uploaded photo",
  sourcePath: UPLOAD,
  role: "authenticated",
  operation: "useRemovePhoto",
  persistence: "storage delete + metadata",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.upload.retry",
  area: "photos",
  route: "/projects/$id/upload",
  control: "Retry failed upload items",
  sourcePath: UPLOAD,
  role: "authenticated",
  operation: "re-upload failed batch items",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.upload.run-analysis",
  area: "photos",
  route: "/projects/$id/upload",
  control: "Run AI Analysis",
  sourcePath: UPLOAD,
  role: "authenticated",
  operation: "navigate analysis",
  severity: "P0",
});

// ---------------------------------------------------------------------------
// CONTROLS — Analysis / scope / estimate / report
// ---------------------------------------------------------------------------
ctrl({
  surfaceId: "ctrl.analysis.retry-weak",
  area: "feasibility",
  route: "/projects/$id/analysis",
  control: "Retry weak analyses",
  sourcePath: "src/routes/_authed/projects.$id.analysis.tsx",
  role: "authenticated",
  operation: "re-run weak photo analyses",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.analysis.continue-estimate",
  area: "feasibility",
  route: "/projects/$id/analysis",
  control: "Continue to estimate",
  sourcePath: "src/routes/_authed/projects.$id.analysis.tsx",
  role: "authenticated",
  operation: "Link estimate",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.scope.generate",
  area: "feasibility",
  route: "/projects/$id/scope",
  control: "Generate/save scope analysis",
  sourcePath: "src/routes/_authed/projects.$id.scope.tsx",
  role: "authenticated",
  operation: "scope analysis mutation",
  persistence: "scope outputs",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.scope.continue-estimate",
  area: "feasibility",
  route: "/projects/$id/scope",
  control: "Continue to estimate from scope",
  sourcePath: "src/routes/_authed/projects.$id.scope.tsx",
  role: "authenticated",
  operation: "navigate estimate",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.estimate.region",
  area: "estimate",
  route: "/projects/$id/estimate",
  control: "Region select",
  sourcePath: "src/routes/_authed/projects.$id.estimate.tsx",
  role: "authenticated",
  operation: "setRegion",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.estimate.condition",
  area: "estimate",
  route: "/projects/$id/estimate",
  control: "Condition select",
  sourcePath: "src/routes/_authed/projects.$id.estimate.tsx",
  role: "authenticated",
  operation: "setCondition",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.estimate.category-checkbox",
  area: "estimate",
  route: "/projects/$id/estimate",
  control: "Category checkboxes",
  sourcePath: "src/routes/_authed/projects.$id.estimate.tsx",
  role: "authenticated",
  operation: "toggle categories",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.estimate.generate-save",
  area: "estimate",
  route: "/projects/$id/estimate",
  control: "Generate/save estimate actions",
  sourcePath: "src/routes/_authed/projects.$id.estimate.tsx",
  role: "authenticated",
  operation: "estimate mutations",
  persistence: "estimates",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.estimate.roi-display",
  area: "roi",
  route: "/projects/$id/estimate",
  control: "Live ROI metrics display",
  sourcePath: "src/routes/_authed/projects.$id.estimate.tsx",
  role: "authenticated",
  operation: "runRoiEngine",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.estimate.continue-report",
  area: "estimate",
  route: "/projects/$id/estimate",
  control: "Continue to report",
  sourcePath: "src/routes/_authed/projects.$id.estimate.tsx",
  role: "authenticated",
  operation: "Link report",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.estimate.instant.l1-submit",
  area: "estimate",
  route: "/estimate/instant",
  control: "L1EstimateForm submit",
  sourcePath: "src/features/estimate/presentation/components/L1EstimateForm.tsx",
  role: "authenticated",
  operation: "instant estimate",
  severity: "P0",
  status: "PARTIAL",
  testReference: "src/features/estimate/presentation/components/L1EstimateForm.test.tsx",
  actualResult: "Unit tests; E2E not verified",
  blocker: "e2e-instant-estimate",
});
ctrl({
  surfaceId: "ctrl.estimate.instant.l2-fields",
  area: "estimate",
  route: "/estimate/instant",
  control: "L2 detail fields",
  sourcePath: "src/features/estimate/presentation/components/L2DetailsFields.tsx",
  role: "authenticated",
  operation: "refine range",
  severity: "P1",
  testReference: "src/features/estimate/presentation/components/L2DetailsFields.test.tsx",
});
ctrl({
  surfaceId: "ctrl.report.print",
  area: "export",
  route: "/projects/$id/report",
  control: "Print report",
  sourcePath: "src/routes/_authed/projects.$id.report.tsx",
  role: "authenticated",
  operation: "window.print",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.report.export-pdf",
  area: "export",
  route: "/projects/$id/report",
  control: "Export PDF",
  sourcePath: "src/routes/_authed/projects.$id.report.tsx",
  role: "authenticated",
  operation: "PDF generation download",
  persistence: "export record may apply",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.report.back-project",
  area: "export",
  route: "/projects/$id/report",
  control: "Back to project",
  sourcePath: "src/routes/_authed/projects.$id.report.tsx",
  role: "authenticated",
  operation: "Link project",
  severity: "P2",
});

// ---------------------------------------------------------------------------
// CONTROLS — Studies / sharing
// ---------------------------------------------------------------------------
ctrl({
  surfaceId: "ctrl.studies.filter-project",
  area: "studies",
  route: "/studies",
  control: "Project filter input/datalist",
  sourcePath: "src/routes/_authed/studies.tsx",
  role: "authenticated",
  operation: "filter studies by projectId",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.studies.open",
  area: "studies",
  route: "/studies",
  control: "Open study",
  sourcePath: "src/routes/_authed/studies.tsx",
  role: "authenticated",
  operation: "Link /studies/$id",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.studies.list.duplicate",
  area: "studies",
  route: "/studies",
  control: "Duplicate (per-card)",
  sourcePath: "src/routes/_authed/studies.tsx",
  role: "authenticated",
  operation: "duplicateStudy.mutate → useDuplicateFeasibilityStudy → feasibilityService.duplicate",
  persistence: "feasibility studies (new snapshot)",
  expectedResult: "Study snapshot duplicated; list invalidates",
  severity: "P1",
  notes: "Replaces prior generic ctrl.studies.create-actions; independent of export/share/archive",
});
ctrl({
  surfaceId: "ctrl.studies.list.export",
  area: "studies",
  route: "/studies",
  control: "Export (per-card)",
  sourcePath: "src/routes/_authed/studies.tsx",
  role: "authenticated",
  operation: "queueExport.mutate → useQueueFeasibilityExport → feasibilityService.queueExport",
  persistence: "export queue / study_exports",
  expectedResult: "Investor export generation queued for study snapshot",
  severity: "P0",
  notes: "title=Queue investor export generation; disabled while queueExport.isPending",
});
ctrl({
  surfaceId: "ctrl.studies.list.share",
  area: "studies",
  route: "/studies",
  control: "Share (per-card)",
  sourcePath: "src/routes/_authed/studies.tsx",
  role: "authenticated",
  operation: "shareStudy.mutate → useShareFeasibilityStudy → feasibilityService.share",
  persistence: "feasibility study share state",
  expectedResult: "Study marked shared; list invalidates",
  severity: "P0",
  notes: "title=Generate secure share link; distinct from share_links detail controls",
});
ctrl({
  surfaceId: "ctrl.studies.list.archive",
  area: "studies",
  route: "/studies",
  control: "Delete (archive per-card)",
  sourcePath: "src/routes/_authed/studies.tsx",
  role: "authenticated",
  operation: "archiveStudy.mutate → useArchiveFeasibilityStudy → feasibilityService.archive",
  persistence: "feasibility study archived status",
  expectedResult: "Study snapshot archived; list invalidates",
  severity: "P0",
  notes: "Visible label Delete; title=Archive this study snapshot",
});
ctrl({
  surfaceId: "ctrl.studies.detail.queue-export",
  area: "studies",
  route: "/studies/$id",
  control: "Queue export",
  sourcePath: "src/routes/_authed/studies.$id.tsx",
  role: "authenticated",
  operation: "queueExport.mutate",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.studies.detail.export-pdf",
  area: "studies",
  route: "/studies/$id",
  control: "Export PDF",
  sourcePath: "src/routes/_authed/studies.$id.tsx",
  role: "authenticated",
  operation: "export PDF",
  severity: "P0",
});
ctrl({
  surfaceId: "ctrl.studies.detail.share-create",
  area: "sharing",
  route: "/studies/$id",
  control: "Create share link",
  sourcePath: "src/routes/_authed/studies.$id.tsx",
  role: "authenticated",
  operation: "useCreateShareLink",
  persistence: "share_links",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.studies.detail.share-revoke",
  area: "sharing",
  route: "/studies/$id",
  control: "Revoke share link",
  sourcePath: "src/routes/_authed/studies.$id.tsx",
  role: "authenticated",
  operation: "useRevokeShareLink",
  persistence: "share_links",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.studies.detail.share-open",
  area: "sharing",
  route: "/studies/$id",
  control: "Open share link external",
  sourcePath: "src/routes/_authed/studies.$id.tsx",
  role: "authenticated",
  operation: "ExternalLink href",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.studies.detail.back",
  area: "studies",
  route: "/studies/$id",
  control: "Back to studies",
  sourcePath: "src/routes/_authed/studies.$id.tsx",
  role: "authenticated",
  operation: "Link /studies",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.studies.detail.regenerate",
  area: "studies",
  route: "/studies/$id",
  control: "Regenerate study",
  sourcePath: "src/routes/_authed/studies.$id.tsx",
  role: "authenticated",
  operation: "create/regenerate study",
  severity: "P1",
});

// ---------------------------------------------------------------------------
// CONTROLS — Deal Copilot
// ---------------------------------------------------------------------------
ctrl({
  surfaceId: "ctrl.deal.list.new",
  area: "deal-copilot",
  route: "/deal-copilot",
  control: "New deal analysis",
  sourcePath: "src/routes/_authed/deal-copilot/index.tsx",
  role: "authenticated",
  operation: "Link /deal-copilot/new",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.deal.list.open",
  area: "deal-copilot",
  route: "/deal-copilot",
  control: "Open opportunity",
  sourcePath: "src/routes/_authed/deal-copilot/index.tsx",
  role: "authenticated",
  operation: "Link opportunity detail",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.deal.new.submit",
  area: "deal-copilot",
  route: "/deal-copilot/new",
  control: "DealIntakeForm submit/analyze",
  sourcePath: "src/components/deal-copilot/DealIntakeForm.tsx",
  role: "authenticated",
  operation: "analyzeDealServerFn",
  persistence: "opportunity+analysis",
  severity: "P1",
  testReference: "src/features/deal-copilot/presentation/hooks/useAnalyzeDealOpportunity.test.ts",
});
ctrl({
  surfaceId: "ctrl.deal.detail.edit",
  area: "deal-copilot",
  route: "/deal-copilot/$opportunityId",
  control: "Edit opportunity",
  sourcePath: "src/routes/_authed/deal-copilot/$opportunityId.tsx",
  role: "authenticated",
  operation: "Link edit",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.deal.detail.back",
  area: "deal-copilot",
  route: "/deal-copilot/$opportunityId",
  control: "Back to list",
  sourcePath: "src/routes/_authed/deal-copilot/$opportunityId.tsx",
  role: "authenticated",
  operation: "Link /deal-copilot",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.deal.detail.listing-url",
  area: "deal-copilot",
  route: "/deal-copilot/$opportunityId",
  control: "Open listing URL",
  sourcePath: "src/routes/_authed/deal-copilot/$opportunityId.tsx",
  role: "authenticated",
  operation: "external a href",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.deal.chat.new-thread",
  area: "deal-copilot",
  route: "/deal-copilot/$opportunityId",
  control: "Create chat thread",
  sourcePath: "src/components/deal-copilot/DealChat.tsx",
  role: "authenticated",
  operation: "createThreadServerFn",
  persistence: "deal threads",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.deal.chat.send",
  area: "deal-copilot",
  route: "/deal-copilot/$opportunityId",
  control: "Send chat message",
  sourcePath: "src/components/deal-copilot/DealChat.tsx",
  role: "authenticated",
  operation: "sendMessageServerFn",
  persistence: "deal messages",
  severity: "P1",
  status: "NOT_TESTED",
  notes: "Depends on OPENAI_API_KEY for AI reply",
});
ctrl({
  surfaceId: "ctrl.deal.chat.mic",
  area: "deal-copilot",
  route: "/deal-copilot/$opportunityId",
  control: "Mic toggle (speech)",
  sourcePath: "src/components/deal-copilot/DealChat.tsx",
  role: "authenticated",
  operation: "browser speech UI",
  severity: "P3",
});
ctrl({
  surfaceId: "ctrl.deal.edit.submit",
  area: "deal-copilot",
  route: "/deal-copilot/$opportunityId/edit",
  control: "Save opportunity edit",
  sourcePath: "src/routes/_authed/deal-copilot/$opportunityId.edit.tsx",
  role: "authenticated",
  operation: "updateOpportunity",
  persistence: "opportunity",
  severity: "P1",
  testReference: "src/features/deal-copilot/presentation/hooks/useUpdateOpportunity.test.ts",
});
ctrl({
  surfaceId: "ctrl.deal.edit.status",
  area: "deal-copilot",
  route: "/deal-copilot/$opportunityId/edit",
  control: "Status select",
  sourcePath: "src/routes/_authed/deal-copilot/$opportunityId.edit.tsx",
  role: "authenticated",
  operation: "set status",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.deal.edit.cancel",
  area: "deal-copilot",
  route: "/deal-copilot/$opportunityId/edit",
  control: "Back/cancel to detail",
  sourcePath: "src/routes/_authed/deal-copilot/$opportunityId.edit.tsx",
  role: "authenticated",
  operation: "Link detail",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.deal.feedback.send",
  area: "deal-copilot",
  route: "/deal-copilot/*",
  control: "DealCopilotFeedback send",
  sourcePath: "src/components/deal-copilot/DealCopilotFeedback.tsx",
  role: "authenticated",
  operation: "submit feedback",
  severity: "P3",
});

// ---------------------------------------------------------------------------
// CONTROLS — Trades / marketplace
// ---------------------------------------------------------------------------
ctrl({
  surfaceId: "ctrl.trades.filter-category",
  area: "trades",
  route: "/trades",
  control: "Category filter chips",
  sourcePath: "src/routes/trades.tsx",
  role: "public",
  operation: "setActiveCategory",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.trades.filter-all",
  area: "trades",
  route: "/trades",
  control: "Filter All categories",
  sourcePath: "src/routes/trades.tsx",
  role: "public",
  operation: "clear category",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.trades.post-job-cta",
  area: "trades",
  route: "/trades",
  control: "Post a job CTAs",
  sourcePath: "src/routes/trades.tsx",
  role: "mixed",
  operation: "Link /trades/new",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.trades.open-job",
  area: "trades",
  route: "/trades",
  control: "Open job card",
  sourcePath: "src/routes/trades.tsx",
  role: "public",
  operation: "Link /trades/$jobId",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.trades.signup-cta",
  area: "trades",
  route: "/trades",
  control: "Create free account CTA",
  sourcePath: "src/routes/trades.tsx",
  role: "public",
  operation: "Link /auth signup",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.trades.job.back",
  area: "trades",
  route: "/trades/$jobId",
  control: "Back to Trades",
  sourcePath: "src/routes/trades_.$jobId.tsx",
  role: "public",
  operation: "Link /trades",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.trades.job.edit",
  area: "trades",
  route: "/trades/$jobId",
  control: "Edit Job",
  sourcePath: "src/routes/trades_.$jobId.tsx",
  role: "authenticated",
  operation: "Link edit",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.trades.job.interest-submit",
  area: "trades",
  route: "/trades/$jobId",
  control: "Submit interest",
  sourcePath: "src/routes/trades_.$jobId.tsx",
  role: "authenticated",
  operation: "create interest",
  persistence: "interests",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.trades.job.interest-unauth",
  area: "trades",
  route: "/trades/$jobId",
  control: "Sign up to register interest",
  sourcePath: "src/routes/trades_.$jobId.tsx",
  role: "public",
  operation: "navigate /auth",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.trades.job.accept",
  area: "trades",
  route: "/trades/$jobId",
  control: "Accept interest",
  sourcePath: "src/routes/trades_.$jobId.tsx",
  role: "authenticated",
  operation: "accept interest",
  persistence: "interest status",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.trades.job.reject",
  area: "trades",
  route: "/trades/$jobId",
  control: "Reject interest",
  sourcePath: "src/routes/trades_.$jobId.tsx",
  role: "authenticated",
  operation: "reject interest",
  persistence: "interest status",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.trades.new.submit",
  area: "trades",
  route: "/trades/new",
  control: "Post job submit",
  sourcePath: "src/routes/_authed/trades_.new.tsx",
  role: "authenticated",
  operation: "create job",
  persistence: "jobs",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.trades.new.category",
  area: "trades",
  route: "/trades/new",
  control: "Job category select",
  sourcePath: "src/routes/_authed/trades_.new.tsx",
  role: "authenticated",
  operation: "form select",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.trades.edit.submit",
  area: "trades",
  route: "/trades/$jobId/edit",
  control: "Save job edit",
  sourcePath: "src/routes/_authed/trades_.$jobId_.edit.tsx",
  role: "authenticated",
  operation: "update job",
  persistence: "jobs",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.trades.profile.submit",
  area: "trades",
  route: "/trades/profile",
  control: "Save trade profile",
  sourcePath: "src/routes/_authed/trades_.profile.tsx",
  role: "authenticated",
  operation: "save profile",
  persistence: "trade profiles",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.trades.profile.categories",
  area: "trades",
  route: "/trades/profile",
  control: "Toggle trade categories",
  sourcePath: "src/routes/_authed/trades_.profile.tsx",
  role: "authenticated",
  operation: "toggleCategory",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.marketplace.search",
  area: "marketplace",
  route: "/marketplace",
  control: "Search tradepersons",
  sourcePath: "src/components/marketplace/MarketplaceFilters.tsx",
  role: "authenticated",
  operation: "setSearchTerm",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.marketplace.filter-specialty",
  area: "marketplace",
  route: "/marketplace",
  control: "Specialty filter",
  sourcePath: "src/components/marketplace/MarketplaceFilters.tsx",
  role: "authenticated",
  operation: "setSpecialtyFilter",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.marketplace.filter-postcode",
  area: "marketplace",
  route: "/marketplace",
  control: "Postcode filter",
  sourcePath: "src/routes/_authed/marketplace.tsx",
  role: "authenticated",
  operation: "setPostcodeFilter",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.marketplace.favorite",
  area: "marketplace",
  route: "/marketplace",
  control: "Toggle favorite tradeperson",
  sourcePath: "src/components/marketplace/TradepersonCard.tsx",
  role: "authenticated",
  operation: "useToggleTradeFavorite",
  persistence: "favorites",
  severity: "P2",
  testReference: "src/features/marketplace/presentation/hooks/useToggleTradeFavorite.test.ts",
});
ctrl({
  surfaceId: "ctrl.marketplace.quote-open",
  area: "marketplace",
  route: "/marketplace",
  control: "Open quote request dialog",
  sourcePath: "src/routes/_authed/marketplace.tsx",
  role: "authenticated",
  operation: "setQuoteDialogOpen",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.marketplace.quote-submit",
  area: "marketplace",
  route: "/marketplace",
  control: "Submit quote request",
  sourcePath: "src/components/marketplace/QuoteRequestDialog.tsx",
  role: "authenticated",
  operation: "useCreateQuoteRequest",
  persistence: "quote requests",
  severity: "P1",
  testReference: "src/features/marketplace/presentation/hooks/useCreateQuoteRequest.test.ts",
});
ctrl({
  surfaceId: "ctrl.marketplace.quote-cancel",
  area: "marketplace",
  route: "/marketplace",
  control: "Cancel quote dialog",
  sourcePath: "src/components/marketplace/QuoteRequestDialog.tsx",
  role: "authenticated",
  operation: "onOpenChange close",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.marketplace.message-send",
  area: "marketplace",
  route: "/marketplace",
  control: "MessagingInbox send",
  sourcePath: "src/components/marketplace/MessagingInbox.tsx",
  role: "authenticated",
  operation: "useSendTradeMessage",
  persistence: "messages",
  severity: "P1",
  testReference: "src/features/marketplace/presentation/hooks/useSendTradeMessage.test.ts",
});

// ---------------------------------------------------------------------------
// CONTROLS — Gallery
// ---------------------------------------------------------------------------
ctrl({
  surfaceId: "ctrl.gallery.list.open",
  area: "gallery",
  route: "/gallery",
  control: "Open gallery project",
  sourcePath: "src/routes/gallery.tsx",
  role: "public",
  operation: "Link /gallery/$slug",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.gallery.list.filter",
  area: "gallery",
  route: "/gallery",
  control: "Gallery filter/control buttons",
  sourcePath: "src/routes/gallery.tsx",
  role: "public",
  operation: "filter UI",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.gallery.detail.back",
  area: "gallery",
  route: "/gallery/$slug",
  control: "Back to gallery",
  sourcePath: "src/routes/gallery.$slug.tsx",
  role: "public",
  operation: "Link /gallery",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.gallery.detail.contact",
  area: "gallery",
  route: "/gallery/$slug",
  control: "Contact Owner anchor",
  sourcePath: "src/routes/gallery.$slug.tsx",
  role: "public",
  operation: "href #inquire",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.gallery.detail.lead-submit",
  area: "gallery",
  route: "/gallery/$slug",
  control: "Investor lead submit",
  sourcePath: "src/routes/gallery.$slug.tsx",
  role: "public",
  operation: "submitInvestorLead",
  persistence: "leads",
  severity: "P1",
});

// ---------------------------------------------------------------------------
// CONTROLS — Settings / admin
// ---------------------------------------------------------------------------
ctrl({
  surfaceId: "ctrl.settings.save",
  area: "settings",
  route: "/settings",
  control: "Save changes",
  sourcePath: "src/routes/_authed/settings.tsx",
  role: "authenticated",
  operation: "localStorage region only",
  persistence: "localStorage",
  status: "BROKEN",
  severity: "P1",
  blocker: "missing-profile-mutation",
  actualResult: "Toast success while full name not server-persisted",
});
ctrl({
  surfaceId: "ctrl.settings.region",
  area: "settings",
  route: "/settings",
  control: "Default region select",
  sourcePath: "src/routes/_authed/settings.tsx",
  role: "authenticated",
  operation: "setDefaultRegion",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.settings.link.privacy",
  area: "settings",
  route: "/settings",
  control: "Privacy Policy link",
  sourcePath: "src/routes/_authed/settings.tsx",
  role: "authenticated",
  operation: "href /privacy",
  severity: "P3",
});
ctrl({
  surfaceId: "ctrl.settings.link.terms",
  area: "settings",
  route: "/settings",
  control: "Terms link",
  sourcePath: "src/routes/_authed/settings.tsx",
  role: "authenticated",
  operation: "href /terms",
  severity: "P3",
});
ctrl({
  surfaceId: "ctrl.settings.link.support",
  area: "settings",
  route: "/settings",
  control: "Contact support link",
  sourcePath: "src/routes/_authed/settings.tsx",
  role: "authenticated",
  operation: "href /support",
  severity: "P3",
});
ctrl({
  surfaceId: "ctrl.settings.delete-open",
  area: "settings",
  route: "/settings",
  control: "Delete Account open dialog",
  sourcePath: "src/routes/_authed/settings.tsx",
  role: "authenticated",
  operation: "setShowDeleteDialog(true)",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.settings.delete-confirm",
  area: "settings",
  route: "/settings",
  control: "Delete Account confirm",
  sourcePath: "src/routes/_authed/settings.tsx",
  role: "authenticated",
  operation: "deleteAccountServerFn",
  persistence: "account deletion",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.settings.delete-cancel",
  area: "settings",
  route: "/settings",
  control: "Delete Account cancel",
  sourcePath: "src/routes/_authed/settings.tsx",
  role: "authenticated",
  operation: "AlertDialogCancel",
  severity: "P2",
});
ctrl({
  surfaceId: "ctrl.admin.gate",
  area: "administration",
  route: "/admin",
  control: "RequireAdmin access gate",
  sourcePath: "src/components/RequireAdmin.tsx",
  role: "admin",
  entitlement: "admin",
  operation: "deny non-admin",
  severity: "P0",
  testReference: "src/routes/_authed/-admin.test.tsx",
});
ctrl({
  surfaceId: "ctrl.admin.stats-view",
  area: "administration",
  route: "/admin",
  control: "Platform stats cards",
  sourcePath: "src/routes/_authed/admin.tsx",
  role: "admin",
  operation: "useAdminPlatformStats",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.admin.projects-view",
  area: "administration",
  route: "/admin",
  control: "Recent projects list",
  sourcePath: "src/routes/_authed/admin.tsx",
  role: "admin",
  operation: "useAdminRecentProjects",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.admin.users-view",
  area: "administration",
  route: "/admin",
  control: "Users list",
  sourcePath: "src/routes/_authed/admin.tsx",
  role: "admin",
  operation: "useAdminUsers",
  severity: "P1",
});
ctrl({
  surfaceId: "ctrl.admin.ai-metrics",
  area: "administration",
  route: "/admin",
  control: "AIMetricsDashboard",
  sourcePath: "src/components/AIMetricsDashboard.tsx",
  role: "admin",
  operation: "view AI metrics",
  severity: "P2",
});

// ---------------------------------------------------------------------------
// BACKEND operations (separate invokable units)
// ---------------------------------------------------------------------------
be({
  surfaceId: "be.auth.get-current-user",
  area: "backend",
  control: "getCurrentUserServerFn",
  sourcePath: "src/serverFns/auth.ts",
  operation: "read current user",
  persistence: "read session/profile",
  severity: "P0",
});
be({
  surfaceId: "be.auth.delete-account",
  area: "backend",
  control: "deleteAccountServerFn",
  sourcePath: "src/serverFns/auth.ts",
  operation: "delete account",
  persistence: "delete user data",
  severity: "P1",
});
be({
  surfaceId: "be.projects.create",
  area: "backend",
  control: "createProjectServerFn",
  sourcePath: "src/serverFns/projects.ts",
  operation: "create project",
  persistence: "projects insert",
  severity: "P0",
});
be({
  surfaceId: "be.projects.stage-set",
  area: "backend",
  control: "projectStageRepository set stage",
  sourcePath: "src/features/projects/infrastructure/projectStageRepository.ts",
  operation: "update stage flags",
  persistence: "project stages",
  severity: "P1",
  testReference: "src/features/projects/presentation/hooks/useSetProjectStage.test.ts",
});
be({
  surfaceId: "be.photos.upload",
  area: "backend",
  control: "photos-write upload batch",
  sourcePath: "src/lib/photos-write.ts",
  operation: "storage write + metadata insert",
  persistence: "project-photos + photos table",
  status: "PARTIAL",
  severity: "P0",
  blocker: "analyze-ui-and-rls-runtime",
  actualResult: "Canonical path exists; analyze UI broken",
});
be({
  surfaceId: "be.photos.remove",
  area: "backend",
  control: "photos-write / remove photo",
  sourcePath: "src/lib/photos-write.ts",
  operation: "storage delete + metadata delete",
  persistence: "storage+db",
  severity: "P1",
});
be({
  surfaceId: "be.photos.health",
  area: "backend",
  control: "checkUploadHealth",
  sourcePath: "src/features/ai-upload/presentation/checkUploadHealth.ts",
  operation: "auth + storage probe",
  persistence: "temp .health/ object",
  severity: "P1",
});
be({
  surfaceId: "be.ai.photo-analysis",
  area: "backend",
  control: "runPhotoAnalysisServerFn",
  sourcePath: "src/features/ai-upload/presentation/serverFns.ts",
  operation: "AI vision analysis",
  persistence: "room_analyses",
  severity: "P0",
});
be({
  surfaceId: "be.ai.photo-analysis-provider",
  area: "backend",
  control: "runPhotoAnalysisWithProviderServerFn",
  sourcePath: "src/features/ai-upload/presentation/serverFns.ts",
  operation: "AI vision with explicit provider",
  persistence: "room_analyses",
  severity: "P1",
});
be({
  surfaceId: "be.ai.scope",
  area: "backend",
  control: "runScopeAnalysisServerFn",
  sourcePath: "src/features/ai-design/presentation/serverFns.ts",
  operation: "scope analysis",
  persistence: "scope outputs",
  severity: "P0",
});
be({
  surfaceId: "be.ai.redesign",
  area: "backend",
  control: "generateRedesignConceptsServerFn",
  sourcePath: "src/features/ai-design/presentation/serverFns.ts",
  operation: "redesign concepts",
  persistence: "AI outputs",
  severity: "P1",
});
be({
  surfaceId: "be.estimate.generate",
  area: "backend",
  control: "generateEstimateServerFn",
  sourcePath: "src/features/estimate/presentation/serverFns.ts",
  operation: "generate estimate",
  persistence: "estimates",
  severity: "P0",
});
be({
  surfaceId: "be.estimate.authority-save",
  area: "backend",
  control: "saveAuthorityCategoryEstimateServerFn",
  sourcePath: "src/features/estimate/presentation/serverFns.ts",
  operation: "RPC authority save",
  persistence: "category estimates",
  severity: "P1",
});
be({
  surfaceId: "be.estimate.repository",
  area: "backend",
  control: "supabaseEstimateRepository",
  sourcePath: "src/features/estimate/infrastructure/repositories/estimate.repository.ts",
  operation: "CRUD project estimates",
  persistence: "estimates",
  severity: "P0",
});
be({
  surfaceId: "be.roi.engine",
  area: "backend",
  control: "deterministicRoiEngine / runRoiEngine",
  sourcePath: "src/features/roi/infrastructure/adapters/roi-engine.adapter.ts",
  operation: "compute ROI metrics",
  persistence: "client compute",
  severity: "P0",
});
be({
  surfaceId: "be.export.pdf",
  area: "backend",
  control: "PDF export pipeline",
  sourcePath: "src/features/export",
  operation: "generate PDF + record",
  persistence: "exports",
  severity: "P0",
});
be({
  surfaceId: "be.export.queue",
  area: "backend",
  control: "queue feasibility export",
  sourcePath: "src/features/export",
  operation: "queue export job",
  persistence: "export queue",
  severity: "P1",
});
be({
  surfaceId: "be.feasibility.repository",
  area: "backend",
  control: "supabaseFeasibilityRepository",
  sourcePath: "src/features/feasibility/infrastructure/repositories/feasibility.repository.ts",
  operation: "study read/write foundation",
  persistence: "feasibility studies",
  severity: "P0",
  notes: "Generic repository; independently failing mutations listed as be.studies.*",
});
be({
  surfaceId: "be.studies.queue-export",
  area: "backend",
  control: "feasibilityService.queueExport",
  sourcePath: "src/features/feasibility/application/feasibilityService.ts",
  operation: "queue study export job",
  persistence: "export queue / study_exports",
  severity: "P0",
  notes: "Reached from ctrl.studies.list.export and useQueueFeasibilityExport",
});
be({
  surfaceId: "be.studies.share",
  area: "backend",
  control: "feasibilityService.share",
  sourcePath: "src/features/feasibility/application/feasibilityService.ts",
  operation: "share feasibility study snapshot",
  persistence: "feasibility studies share status",
  severity: "P0",
  notes: "Reached from ctrl.studies.list.share; not share_links token CRUD",
});
be({
  surfaceId: "be.studies.archive",
  area: "backend",
  control: "feasibilityService.archive",
  sourcePath: "src/features/feasibility/application/feasibilityService.ts",
  operation: "archive feasibility study snapshot",
  persistence: "feasibility studies archived status",
  severity: "P0",
  notes: "Reached from ctrl.studies.list.archive (UI label Delete)",
});
be({
  surfaceId: "be.studies.duplicate",
  area: "backend",
  control: "feasibilityService.duplicate",
  sourcePath: "src/features/feasibility/application/feasibilityService.ts",
  operation: "duplicate feasibility study snapshot",
  persistence: "feasibility studies insert copy",
  severity: "P1",
  notes: "Reached from ctrl.studies.list.duplicate",
});
be({
  surfaceId: "be.trades.job.create",
  area: "backend",
  control: "createTradesJob",
  sourcePath: "src/features/trades/infrastructure/repositories/tradesJobStore.ts",
  operation: "create trades job row",
  persistence: "trades_jobs insert",
  severity: "P1",
  notes: "Reached from /trades/new submit (ctrl.trades.new.submit)",
});
be({
  surfaceId: "be.trades.job.update",
  area: "backend",
  control: "updateTradesJob",
  sourcePath: "src/features/trades/infrastructure/repositories/tradesJobStore.ts",
  operation: "update trades job fields/status",
  persistence: "trades_jobs update",
  severity: "P1",
  notes: "Reached from job edit form and dashboard close (status closed)",
});
be({
  surfaceId: "be.trades.job.delete",
  area: "backend",
  control: "deleteTradesJob",
  sourcePath: "src/features/trades/infrastructure/repositories/tradesJobStore.ts",
  operation: "delete trades job row",
  persistence: "trades_jobs delete",
  severity: "P2",
  notes:
    "Exported production store API; no UI caller found in routes (close uses update). Inventory retained for store surface.",
});
be({
  surfaceId: "be.trades.interest.create",
  area: "backend",
  control: "createTradesJobInterest",
  sourcePath: "src/features/trades/infrastructure/repositories/tradesJobInterestStore.ts",
  operation: "create job interest",
  persistence: "trades_job_interests insert",
  severity: "P1",
  notes: "Reached from /trades/$jobId interest submit",
});
be({
  surfaceId: "be.trades.interest.update",
  area: "backend",
  control: "updateTradesJobInterestStatus",
  sourcePath: "src/features/trades/infrastructure/repositories/tradesJobInterestStore.ts",
  operation: "accept/reject interest status",
  persistence: "trades_job_interests status update",
  severity: "P1",
  notes: "Reached from owner Accept/Reject on job detail",
});
be({
  surfaceId: "be.trades.profile.upsert",
  area: "backend",
  control: "upsertCurrentUserTradeProfile",
  sourcePath: "src/features/trades/infrastructure/repositories/tradeProfileStore.ts",
  operation: "upsert trade profile",
  persistence: "trade_profiles upsert",
  severity: "P1",
  notes: "Reached from /trades/profile submit",
});
be({
  surfaceId: "be.marketplace.quote.create",
  area: "backend",
  control: "createQuoteRequest",
  sourcePath: "src/lib/marketplace-write.ts",
  operation: "create quote request",
  persistence: "quote_requests insert",
  severity: "P1",
  notes: "Reached via useCreateQuoteRequest / QuoteRequestDialog submit",
  testReference: "src/features/marketplace/presentation/hooks/useCreateQuoteRequest.test.ts",
});
be({
  surfaceId: "be.marketplace.message.send",
  area: "backend",
  control: "sendTradeMessage",
  sourcePath: "src/lib/marketplace-write.ts",
  operation: "send trade marketplace message",
  persistence: "trade_messages insert",
  severity: "P1",
  notes: "Reached via useSendTradeMessage / MessagingInbox",
  testReference: "src/features/marketplace/presentation/hooks/useSendTradeMessage.test.ts",
});
be({
  surfaceId: "be.marketplace.favorite.toggle",
  area: "backend",
  control: "addTradeFavorite / removeTradeFavorite via useToggleTradeFavorite",
  sourcePath: "src/lib/marketplace-write.ts",
  operation: "toggle trade favorite",
  persistence: "trade_favorites insert/delete",
  severity: "P2",
  notes: "Hook owns optimistic cache; persistence in marketplace-write",
  testReference: "src/features/marketplace/presentation/hooks/useToggleTradeFavorite.test.ts",
});
be({
  surfaceId: "be.sharing.create",
  area: "backend",
  control: "ShareLink create",
  sourcePath: "src/features/sharing/infrastructure/shareLink.repository.ts",
  operation: "insert share_links",
  persistence: "share_links",
  severity: "P1",
});
be({
  surfaceId: "be.sharing.list",
  area: "backend",
  control: "ShareLink listByStudy",
  sourcePath: "src/features/sharing/infrastructure/shareLink.repository.ts",
  operation: "read share_links",
  persistence: "read",
  severity: "P1",
});
be({
  surfaceId: "be.sharing.revoke",
  area: "backend",
  control: "ShareLink revoke",
  sourcePath: "src/features/sharing/infrastructure/shareLink.repository.ts",
  operation: "revoke share_links",
  persistence: "share_links",
  severity: "P1",
});
be({
  surfaceId: "be.gallery.repository",
  area: "backend",
  control: "gallery repository",
  sourcePath: "src/features/gallery/infrastructure/galleryRepository.ts",
  operation: "gallery CRUD",
  persistence: "gallery",
  severity: "P1",
});
be({
  surfaceId: "be.gallery.lead",
  area: "backend",
  control: "submitInvestorLead",
  sourcePath: "src/core/gallery/serverFns.ts",
  role: "public",
  operation: "store investor lead",
  persistence: "leads",
  severity: "P1",
});
be({
  surfaceId: "be.deal.save",
  area: "backend",
  control: "saveDealOpportunityServerFn",
  sourcePath: "src/serverFns/dealCopilot.ts",
  operation: "upsert opportunity",
  persistence: "opportunities",
  severity: "P1",
});
be({
  surfaceId: "be.deal.delete",
  area: "backend",
  control: "deleteDealOpportunityServerFn",
  sourcePath: "src/serverFns/dealCopilot.ts",
  operation: "delete opportunity",
  persistence: "opportunities",
  severity: "P1",
  notes: "ServerFn exists; UI exposure may be limited",
});
be({
  surfaceId: "be.deal.analyze",
  area: "backend",
  control: "analyzeDealServerFn",
  sourcePath: "src/serverFns/dealAnalysis.ts",
  operation: "AI deal analysis",
  persistence: "analysis",
  severity: "P1",
});
be({
  surfaceId: "be.deal.chat.create-thread",
  area: "backend",
  control: "createThreadServerFn",
  sourcePath: "src/serverFns/dealChat.ts",
  operation: "create thread",
  persistence: "threads",
  severity: "P1",
});
be({
  surfaceId: "be.deal.chat.list-threads",
  area: "backend",
  control: "listThreadsServerFn",
  sourcePath: "src/serverFns/dealChat.ts",
  operation: "list threads",
  persistence: "read",
  severity: "P2",
});
be({
  surfaceId: "be.deal.chat.list-messages",
  area: "backend",
  control: "listMessagesServerFn",
  sourcePath: "src/serverFns/dealChat.ts",
  operation: "list messages",
  persistence: "read",
  severity: "P1",
});
be({
  surfaceId: "be.deal.chat.send",
  area: "backend",
  control: "sendMessageServerFn",
  sourcePath: "src/serverFns/dealChat.ts",
  operation: "send message + AI reply",
  persistence: "messages",
  status: "BLOCKED_CONFIGURATION",
  severity: "P1",
  blocker: "OPENAI_API_KEY-or-staging",
  actualResult: "Adapter requires OPENAI_API_KEY",
});
be({
  surfaceId: "be.admin.stats",
  area: "backend",
  control: "admin platform stats read",
  sourcePath: "src/features/admin",
  operation: "admin metrics queries",
  persistence: "read",
  severity: "P1",
});
be({
  surfaceId: "be.email.send",
  area: "backend",
  control: "Resend email helper",
  sourcePath: "src/lib/email.ts",
  operation: "send email",
  persistence: "provider",
  severity: "P1",
});
be({
  surfaceId: "be.payment.create-checkout",
  area: "backend",
  control: "createCheckout (mock gateway)",
  sourcePath: "src/platform/payments/index.ts",
  operation: "returns mock-checkout",
  persistence: "none",
  status: "NOT_TESTED",
  severity: "P2",
  notes:
    "Mock adapter; no production checkout UI control exposed — not BLOCKED_EXTERNAL production outage",
  exposure: "mock-only",
});
be({
  surfaceId: "be.payment.has-pro-access",
  area: "backend",
  control: "hasProAccess gate",
  sourcePath: "src/features/payment/application/hasProAccess.ts",
  operation: "email domain / flag gate",
  persistence: "none",
  severity: "P1",
  notes: "Not Stripe entitlement",
});
be({
  surfaceId: "be.payment.verify-webhook",
  area: "backend",
  control: "verifyWebhook",
  sourcePath: "src/features/payment/application/verifyWebhook.ts",
  operation: "webhook verification",
  persistence: "entitlements if wired",
  status: "NOT_TESTED",
  severity: "P2",
  notes: "Adapter present; production webhook exposure unverified",
});

// ---------------------------------------------------------------------------
// INTEGRATIONS
// ---------------------------------------------------------------------------
integ({
  surfaceId: "int.supabase.browser",
  area: "integrations",
  control: "Supabase browser client",
  sourcePath: "packages/supabase/src/env.ts",
  operation: "client auth/db/storage",
  exposure: "production-visible",
  severity: "P0",
  notes: "VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY",
});
integ({
  surfaceId: "int.supabase.server",
  area: "integrations",
  control: "Supabase server/service client",
  sourcePath: "src/platform/supabase/service.server.ts",
  operation: "service role server ops",
  exposure: "production-visible",
  severity: "P0",
  notes: "SUPABASE_SERVICE_ROLE_KEY server-only",
});
integ({
  surfaceId: "int.supabase.storage",
  area: "integrations",
  control: "Storage buckets project-photos/gallery",
  sourcePath: "src/lib/photos-write.ts",
  operation: "storage read/write",
  exposure: "production-visible",
  severity: "P0",
});
integ({
  surfaceId: "int.openai",
  area: "integrations",
  control: "OpenAI",
  sourcePath: "src/platform/openai/server.ts",
  operation: "AI requests",
  exposure: "production-visible",
  severity: "P0",
  notes: "OPENAI_API_KEY",
});
integ({
  surfaceId: "int.huggingface",
  area: "integrations",
  control: "HuggingFace vision/text",
  sourcePath: "src/platform/huggingface/server.ts",
  operation: "fallback AI",
  exposure: "production-visible",
  severity: "P1",
  notes: "HUGGINGFACE_API_KEY optional path",
});
integ({
  surfaceId: "int.resend",
  area: "integrations",
  control: "Resend email",
  sourcePath: "src/lib/email.ts",
  operation: "email send",
  exposure: "production-visible",
  severity: "P1",
  notes: "RESEND_API_KEY",
});
integ({
  surfaceId: "int.oauth.google",
  area: "integrations",
  control: "Google OAuth provider",
  sourcePath: "src/features/auth/presentation/hooks/useOAuthSignIn.ts",
  operation: "OAuth redirect",
  exposure: "production-visible",
  severity: "P0",
});
integ({
  surfaceId: "int.oauth.apple",
  area: "integrations",
  control: "Apple OAuth provider",
  sourcePath: "src/features/auth/presentation/hooks/useOAuthSignIn.ts",
  operation: "OAuth redirect",
  exposure: "production-visible",
  severity: "P0",
  notes: "VITE_APPLE_CLIENT_ID meta also present",
});
integ({
  surfaceId: "int.oauth.github",
  area: "integrations",
  control: "GitHub OAuth provider",
  sourcePath: "src/features/auth/presentation/hooks/useOAuthSignIn.ts",
  operation: "OAuth redirect",
  exposure: "production-visible",
  severity: "P0",
});
integ({
  surfaceId: "int.payment.mock",
  area: "integrations",
  control: "Payment mock adapter",
  sourcePath: "src/platform/payments/index.ts",
  operation: "mock createCheckout",
  exposure: "mock-only",
  status: "NOT_TESTED",
  severity: "P2",
  notes: "Not a production-visible payment control; no checkout UI route",
});
integ({
  surfaceId: "int.payment.pro-flag",
  area: "integrations",
  control: "VITE_ENABLE_PRO_FEATURES / domain pro gate",
  sourcePath: "src/features/payment/application/hasProAccess.ts",
  operation: "feature gate",
  exposure: "production-visible",
  severity: "P1",
});
integ({
  surfaceId: "int.posthog",
  area: "integrations",
  control: "PostHog analytics",
  sourcePath: "src/platform/posthog",
  operation: "analytics",
  exposure: "optional",
  severity: "P3",
  notes: "VITE_PUBLIC_POSTHOG_PROJECT_TOKEN",
});
integ({
  surfaceId: "int.sentry",
  area: "integrations",
  control: "Sentry",
  sourcePath: "src/lib/sentry.ts",
  operation: "error reporting",
  exposure: "optional",
  severity: "P2",
  notes: "VITE_SENTRY_DSN",
});
integ({
  surfaceId: "int.public-url",
  area: "integrations",
  control: "VITE_PUBLIC_URL",
  sourcePath: "src/routes/__root.tsx",
  operation: "absolute URL base",
  exposure: "production-visible",
  severity: "P1",
});
integ({
  surfaceId: "int.export.pdf-runtime",
  area: "integrations",
  control: "PDF export runtime",
  sourcePath: "src/features/export",
  operation: "client/server PDF",
  exposure: "production-visible",
  severity: "P0",
});

// ---------------------------------------------------------------------------
// Counts + document assembly
// ---------------------------------------------------------------------------
function computeCounts() {
  const byStatus = Object.fromEntries(ALLOWED_STATUS.map((s) => [s, 0]));
  const byKind = { route: 0, control: 0, backend: 0, integration: 0 };
  for (const s of surfaces) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
  }
  return {
    routes: byKind.route,
    controls: byKind.control,
    backendOperations: byKind.backend,
    externalIntegrations: byKind.integration,
    totalSurfaces: surfaces.length,
    byStatus,
    byKind,
  };
}

const counts = computeCounts();

const doc = {
  meta: {
    programme: "P0-APP",
    phase: PHASE,
    title: "Application Functional Surface Register",
    baselineMainSha: BASELINE,
    inventoryBranch: "audit/p0-app-operational-baseline",
    inventoryDate: DATE,
    method: "static-code-inspection-with-route-tree-reconciliation",
    runtimeVerificationComplete: false,
    jsonCanonical: true,
    markdownGeneratedFromJson: true,
    relatedUnmergedRepairs: [
      {
        pr: 104,
        branch: "fix/p0-property-photo-capture-upload",
        commit: "fe407ccc8b8353b0cde68a331c56396f8e367818",
        summary: "Photo capture/upload repair; not merged into main at inventory time",
      },
    ],
    statusVocabulary: ALLOWED_STATUS,
    severityVocabulary: ["P0", "P1", "P2", "P3"],
    kindVocabulary: ["route", "control", "backend", "integration"],
    notes:
      "No surface marked WORKING. Controls inventoried individually. Routes reconciled against routeTree.gen.ts fullPaths. Perfect AST control discovery is NOT claimed.",
  },
  counts,
  surfaces,
  coreJourney: [
    { step: "signup", surfaceIds: ["ctrl.auth.signup-submit", "route.auth"], status: "NOT_TESTED" },
    { step: "signin", surfaceIds: ["ctrl.auth.signin-submit", "route.auth"], status: "NOT_TESTED" },
    {
      step: "project",
      surfaceIds: ["ctrl.projects.new.submit", "route.projects.new"],
      status: "NOT_TESTED",
    },
    {
      step: "photos",
      surfaceIds: [
        "ctrl.analyze.photo.take",
        "ctrl.analyze.photo.library",
        "ctrl.upload.camera",
        "route.projects.upload",
      ],
      status: "BROKEN",
    },
    {
      step: "analysis",
      surfaceIds: ["route.projects.analysis", "be.ai.photo-analysis"],
      status: "NOT_TESTED",
    },
    { step: "scope", surfaceIds: ["route.projects.scope", "be.ai.scope"], status: "NOT_TESTED" },
    { step: "redesign", surfaceIds: ["be.ai.redesign"], status: "NOT_TESTED" },
    {
      step: "estimate",
      surfaceIds: ["route.projects.estimate", "ctrl.estimate.instant.l1-submit"],
      status: "NOT_TESTED",
    },
    {
      step: "roi",
      surfaceIds: ["ctrl.estimate.roi-display", "be.roi.engine"],
      status: "NOT_TESTED",
    },
    {
      step: "export",
      surfaceIds: ["ctrl.report.export-pdf", "be.export.pdf"],
      status: "NOT_TESTED",
    },
    {
      step: "reopen",
      surfaceIds: ["route.studies.detail", "ctrl.studies.open"],
      status: "NOT_TESTED",
    },
    {
      step: "share_download",
      surfaceIds: ["ctrl.studies.detail.share-create", "ctrl.studies.detail.export-pdf"],
      status: "NOT_TESTED",
    },
  ],
  p0OpenIssues: [
    {
      id: "P0-PHOTO-ANALYZE",
      summary:
        "Analyze route cannot capture/select photos without project; camera input multi-file; free-text project id",
      surfaceIds: [
        "ctrl.analyze.photo.take",
        "ctrl.analyze.photo.library",
        "ctrl.analyze.photo.camera-input",
        "ctrl.analyze.project-select",
        "route.analyze",
      ],
      relatedPr: 104,
    },
    {
      id: "P0-AUTH-E2E",
      summary: "Auth journeys lack runtime E2E evidence",
      surfaceIds: ["route.auth", "ctrl.auth.signin-submit", "ctrl.auth.signup-submit"],
    },
    {
      id: "P0-ADMIN-GATE",
      summary: "Admin role denial not negative-probed",
      surfaceIds: ["ctrl.admin.gate", "route.admin"],
    },
  ],
  knownRequiredControls: [
    "ctrl.analyze.photo.take",
    "ctrl.analyze.photo.library",
    "ctrl.analyze.photo.camera-input",
    "ctrl.analyze.project-select",
    "ctrl.auth.signin-submit",
    "ctrl.auth.signup-submit",
    "ctrl.auth.oauth.google",
    "ctrl.auth.magic-link",
    "ctrl.auth.signout",
    "ctrl.settings.save",
    "ctrl.admin.gate",
    "ctrl.studies.list.export",
    "ctrl.studies.list.share",
    "ctrl.studies.list.archive",
    "ctrl.studies.list.duplicate",
  ],
  knownRequiredBackendOperations: [
    "be.trades.job.create",
    "be.trades.job.update",
    "be.trades.job.delete",
    "be.trades.interest.create",
    "be.trades.interest.update",
    "be.trades.profile.upsert",
    "be.marketplace.quote.create",
    "be.marketplace.message.send",
    "be.marketplace.favorite.toggle",
    "be.studies.queue-export",
    "be.studies.share",
    "be.studies.archive",
  ],
  pausedWork: ["4C2E evidence-vault", "catalogue-publication", "D1 implementation"],
};

// Validate uniqueness before write
const ids = new Set();
for (const s of surfaces) {
  if (ids.has(s.surfaceId)) throw new Error(`Duplicate surfaceId ${s.surfaceId}`);
  ids.add(s.surfaceId);
  if (!ALLOWED_STATUS.includes(s.status)) throw new Error(`Bad status ${s.status}`);
  if (s.status === "WORKING") throw new Error(`WORKING forbidden in audit: ${s.surfaceId}`);
  if ((s.status === "BROKEN" || s.status.startsWith("BLOCKED_")) && !s.blocker) {
    throw new Error(`Missing blocker for ${s.surfaceId}`);
  }
  if (
    !existsSync(join(root, s.sourcePath)) &&
    !s.sourcePath.includes("*") &&
    s.sourcePath !== "src/features/export" &&
    s.sourcePath !== "src/features/admin" &&
    s.sourcePath !== "src/platform/posthog" &&
    s.sourcePath !== "src/components/deal-copilot"
  ) {
    // allow directory roots used as feature refs
    const p = join(root, s.sourcePath);
    if (!existsSync(p)) {
      console.warn(`WARN source missing: ${s.sourcePath} (${s.surfaceId})`);
    }
  }
}

const jsonPath = join(root, "docs/operations/app-functional-surface-register.json");
writeFileSync(jsonPath, JSON.stringify(doc, null, 2) + "\n");

// Generate Markdown from JSON
function mdEscape(s) {
  return String(s ?? "").replace(/\|/g, "\\|");
}

const md = [];
md.push("# Application Functional Surface Register");
md.push("");
md.push(`**Programme:** P0-APP — Full Application Operational Readiness`);
md.push(`**Phase:** ${PHASE} — Functional Surface Inventory Repair and Completeness Enforcement`);
md.push(`**Branch:** \`audit/p0-app-operational-baseline\``);
md.push(`**Baseline main SHA:** \`${BASELINE}\``);
md.push(`**Inventory date:** ${DATE}`);
md.push(`**Canonical data:** JSON (this Markdown is generated from JSON)`);
md.push(
  `**Method:** Static inspection + \`routeTree.gen.ts\` reconciliation. Perfect AST discovery is **not** claimed.`,
);
md.push("");
md.push(
  `Machine-readable twin: [\`app-functional-surface-register.json\`](./app-functional-surface-register.json).`,
);
md.push(
  `Exceptions allowlist: [\`app-functional-surface-exceptions.json\`](./app-functional-surface-exceptions.json).`,
);
md.push("");
md.push("> No surface is marked `WORKING`. Runtime verification is incomplete.");
md.push("");
md.push("## Counts");
md.push("");
md.push("| Metric | Count |");
md.push("| --- | ---: |");
md.push(`| Routes | ${counts.routes} |`);
md.push(`| Controls | ${counts.controls} |`);
md.push(`| Backend operations | ${counts.backendOperations} |`);
md.push(`| External integrations | ${counts.externalIntegrations} |`);
md.push(`| **Total surfaces** | **${counts.totalSurfaces}** |`);
md.push("");
md.push("### Status totals");
md.push("");
md.push("| Status | Count |");
md.push("| --- | ---: |");
for (const st of ALLOWED_STATUS) {
  md.push(`| ${st} | ${counts.byStatus[st] ?? 0} |`);
}
md.push("");
md.push("## Routes");
md.push("");
md.push("| surfaceId | route | authClass | sourcePath | status | severity |");
md.push("| --- | --- | --- | --- | --- | --- |");
for (const s of surfaces.filter((x) => x.kind === "route")) {
  md.push(
    `| \`${s.surfaceId}\` | \`${mdEscape(s.route)}\` | ${s.authClass ?? s.role} | \`${s.sourcePath}\` | ${s.status} | ${s.severity} |`,
  );
}
md.push("");
md.push("## Controls (by area)");
md.push("");
const areas = [...new Set(surfaces.filter((s) => s.kind === "control").map((s) => s.area))].sort();
for (const area of areas) {
  md.push(`### ${area}`);
  md.push("");
  md.push("| surfaceId | control | route | status | severity | blocker |");
  md.push("| --- | --- | --- | --- | --- | --- |");
  for (const s of surfaces.filter((x) => x.kind === "control" && x.area === area)) {
    md.push(
      `| \`${s.surfaceId}\` | ${mdEscape(s.control)} | \`${mdEscape(s.route)}\` | ${s.status} | ${s.severity} | ${s.blocker ?? "—"} |`,
    );
  }
  md.push("");
}
md.push("## Backend operations");
md.push("");
md.push("| surfaceId | control | sourcePath | status | severity |");
md.push("| --- | --- | --- | --- | --- |");
for (const s of surfaces.filter((x) => x.kind === "backend")) {
  md.push(
    `| \`${s.surfaceId}\` | ${mdEscape(s.control)} | \`${s.sourcePath}\` | ${s.status} | ${s.severity} |`,
  );
}
md.push("");
md.push("## Integrations");
md.push("");
md.push("| surfaceId | control | exposure | status | severity |");
md.push("| --- | --- | --- | --- | --- |");
for (const s of surfaces.filter((x) => x.kind === "integration")) {
  md.push(
    `| \`${s.surfaceId}\` | ${mdEscape(s.control)} | ${s.exposure ?? "—"} | ${s.status} | ${s.severity} |`,
  );
}
md.push("");
md.push("## Confirmed P0 BROKEN surfaces");
md.push("");
for (const s of surfaces.filter((x) => x.severity === "P0" && x.status === "BROKEN")) {
  md.push(`- \`${s.surfaceId}\` — ${s.actualResult} (blocker: ${s.blocker})`);
}
md.push("");
md.push("## Core journey map");
md.push("");
md.push("| Step | Status | Surfaces |");
md.push("| --- | --- | --- |");
for (const j of doc.coreJourney) {
  md.push(`| ${j.step} | ${j.status} | ${j.surfaceIds.map((id) => `\`${id}\``).join(", ")} |`);
}
md.push("");
md.push("## Validation");
md.push("");
md.push("```bash");
md.push("node scripts/validate-functional-surface-register.mjs");
md.push("pnpm exec tsx --test tests/invariants/functional-surface-register.invariant.test.ts");
md.push("```");
md.push("");
md.push("## 4C2E status");
md.push("");
md.push(
  "4C2E evidence-vault, catalogue-publication and D1 work remain paused until the application operational programme is independently closed.",
);
md.push("");
md.push("---");
md.push("");
md.push(
  `Generated ${DATE} by \`scripts/build-functional-surface-register.mjs\` from inventory phase ${PHASE}.`,
);
md.push("");

const mdPath = join(root, "docs/operations/app-functional-surface-register.md");
writeFileSync(mdPath, md.join("\n"));

console.log("Wrote", jsonPath);
console.log("Wrote", mdPath);
console.log("totals", counts);
