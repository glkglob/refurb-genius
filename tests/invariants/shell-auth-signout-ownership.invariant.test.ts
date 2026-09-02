/**
 * AO-1S1 — Shell components must not own browser auth.signOut.
 *
 * Progressive seal: useSignOut from @/features/auth.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment, dynamic import string splits, computed property names,
 * wrapper indirection.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

const SIDEBAR = "src/components/Sidebar.tsx";
const MOBILE = "src/components/MobileTopBar.tsx";
/** Mobile A moved the primary destination row (and its More menu) here. */
const MOBILE_BOTTOM = "src/components/MobileBottomNav.tsx";

/** Every shell component permitted to consume useSignOut. */
const SHELL_SIGN_OUT_CONSUMERS = [SIDEBAR, MOBILE, MOBILE_BOTTOM] as const;
const HOOK = "src/features/auth/presentation/hooks/useSignOut.ts";
const INFRA = "src/features/auth/infrastructure/signOutSession.ts";
const PRESENTATION_API = "src/features/auth/presentation/index.ts";
const FEATURE_API = "src/features/auth/index.ts";

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

function read(rel: string): string {
  const full = join(ROOT, rel);
  assert.ok(existsSync(full), `missing ${rel}`);
  return stripAllComments(readFileSync(full, "utf8"));
}

function assertShellCanonical(rel: string): void {
  const text = read(rel);
  assert.match(
    text,
    /useSignOut[^;]*from\s+["']@\/features\/auth["']/,
    `${rel} must import useSignOut from @/features/auth`,
  );
  assert.match(text, /useSignOut\s*\(/, `${rel} must call useSignOut(`);
  assert.match(text, /await\s+signOut\s*\(/, `${rel} must await signOut(`);
  assert.match(text, /navigate\s*\(/, `${rel} must call navigate(`);
  assert.match(text, /to\s*:\s*["']\/["']/, `${rel} must navigate to "/"`);
}

/** Sign-out must complete before the shell leaves the authenticated surface. */
function assertSignOutPrecedesNavigation(rel: string): void {
  const text = read(rel);
  const handler = text.match(
    /const\s+handleLogout\s*=\s*async\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\n\s*\};/,
  );
  assert.ok(handler?.[1], `${rel} must define an async handleLogout sign-out handler`);
  const body = handler[1];
  assert.match(body, /await\s+signOut\s*\(\s*\)/, `${rel} must await signOut()`);
  assert.match(body, /navigate\s*\(\s*\{\s*to\s*:\s*["']\/["']\s*\}\s*\)/, `${rel} must go to "/"`);
  assert.ok(
    body.indexOf("await signOut()") < body.indexOf("navigate("),
    `${rel} must await signOut() before navigating to "/"`,
  );
}

/** Recursively list .tsx sources under a directory, excluding test files. */
function listComponentSources(relDir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, relDir), { withFileTypes: true })) {
    const rel = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...listComponentSources(rel));
      continue;
    }
    if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) out.push(rel);
  }
  return out;
}

function assertShellBans(rel: string): void {
  const text = read(rel);
  assert.doesNotMatch(text, /@\/lib\/auth/, `${rel} must not import @/lib/auth`);
  assert.doesNotMatch(text, /auth\.signOut/, `${rel} must not call auth.signOut`);
  assert.doesNotMatch(
    text,
    /supabase\.auth\.signOut/,
    `${rel} must not call supabase.auth.signOut`,
  );
  assert.doesNotMatch(
    text,
    /createBrowserSupabase/,
    `${rel} must not reference createBrowserSupabase`,
  );
  assert.doesNotMatch(text, /useQueryClient/, `${rel} must not use useQueryClient`);
  assert.doesNotMatch(text, /queryClient\.clear/, `${rel} must not call queryClient.clear`);
  assert.doesNotMatch(text, /invalidateQueries/, `${rel} must not call invalidateQueries`);
  assert.doesNotMatch(text, /removeQueries/, `${rel} must not call removeQueries`);
  assert.doesNotMatch(text, /setQueryData/, `${rel} must not call setQueryData`);
  assert.doesNotMatch(text, /SERVICE_ROLE/, `${rel} must not reference service role`);
  assert.doesNotMatch(text, /\.server/, `${rel} must not import .server modules`);
}

test("shell sign-out — feature public API exports useSignOut", () => {
  const presentation = read(PRESENTATION_API);
  assert.match(presentation, /useSignOut/, "presentation barrel must export useSignOut");
  assert.doesNotMatch(
    presentation,
    /signOutSession/,
    "presentation barrel must not export signOutSession",
  );

  const root = read(FEATURE_API);
  assert.match(
    root,
    /export \* from ["']\.\/presentation["']/,
    "auth root must re-export presentation",
  );
});

test("shell sign-out — Sidebar imports useSignOut from @/features/auth", () => {
  assertShellCanonical(SIDEBAR);
});

test("shell sign-out — MobileTopBar imports useSignOut from @/features/auth", () => {
  assertShellCanonical(MOBILE);
});

test("shell sign-out — MobileBottomNav imports useSignOut from @/features/auth", () => {
  assertShellCanonical(MOBILE_BOTTOM);
});

test("shell sign-out — shell components ban residual auth infrastructure", () => {
  assertShellBans(SIDEBAR);
  assertShellBans(MOBILE);
  assertShellBans(MOBILE_BOTTOM);
});

test("shell sign-out — every shell awaits signOut before navigating to /", () => {
  for (const rel of SHELL_SIGN_OUT_CONSUMERS) {
    assertSignOutPrecedesNavigation(rel);
  }
});

test("shell sign-out — mobile sign-out ownership is completely enumerated", () => {
  const actual = listComponentSources("src/components")
    .filter((rel) => /useSignOut\s*\(/.test(read(rel)))
    .sort();
  assert.deepEqual(
    actual,
    [...SHELL_SIGN_OUT_CONSUMERS].sort(),
    "every src/components sign-out consumer must be sealed by this invariant",
  );
});

test("shell sign-out — hook owns signOutSession delegation without QC or navigation", () => {
  const text = read(HOOK);
  assert.match(text, /useSignOut/, "hook must define useSignOut");
  assert.match(text, /signOutSession/, "hook must reference signOutSession");
  assert.match(text, /signOut/, "hook must expose signOut");
  assert.doesNotMatch(text, /useMutation/, "hook must not use useMutation");
  assert.doesNotMatch(text, /useQueryClient/, "hook must not use useQueryClient");
  assert.doesNotMatch(text, /navigate\s*\(/, "hook must not navigate");
  assert.doesNotMatch(text, /useNavigate/, "hook must not import useNavigate");
  assert.doesNotMatch(text, /window\.location/, "hook must not use window.location");
  assert.doesNotMatch(text, /toast/, "hook must not toast");
  assert.doesNotMatch(text, /trackEvent/, "hook must not emit analytics");
  assert.doesNotMatch(text, /auth\.signOut/, "hook must not call auth.signOut directly");
  assert.doesNotMatch(text, /@\/lib\/auth/, "hook must not import @/lib/auth");
  assert.doesNotMatch(text, /\.server/, "hook must not import .server modules");
});

test("shell sign-out — infrastructure delegates to auth.signOut without options", () => {
  const text = read(INFRA);
  assert.match(text, /auth/, "infra must reference auth");
  assert.match(text, /signOut/, "infra must reference signOut");
  assert.match(text, /await\s+auth\.signOut\s*\(\s*\)/, "infra must await auth.signOut()");
  assert.doesNotMatch(text, /scope\s*:/, "infra must not set scope");
  assert.doesNotMatch(text, /useQueryClient|QueryClient/, "infra must not use QueryClient");
  assert.doesNotMatch(text, /navigate\s*\(/, "infra must not navigate");
  assert.doesNotMatch(text, /toast/, "infra must not toast");
  assert.doesNotMatch(text, /trackEvent/, "infra must not emit analytics");
  assert.doesNotMatch(text, /SERVICE_ROLE/, "infra must not use service role");
  assert.doesNotMatch(text, /createSupabaseServerClient/, "infra must not use server Supabase");
});

test("shell sign-out — probe: direct auth.signOut in shell forbidden", () => {
  const probe = `
import { auth } from "@/lib/auth";
await auth.signOut();
`;
  assert.match(probe, /@\/lib\/auth/);
  assert.match(probe, /auth\.signOut/);
  assert.doesNotMatch(probe, /useSignOut/);
});

test("shell sign-out — probe: QueryClient clear in shell forbidden", () => {
  const probe = `
const queryClient = useQueryClient();
queryClient.clear();
`;
  assert.match(probe, /useQueryClient/);
  assert.match(probe, /queryClient\.clear/);
});

test("shell sign-out — probe: navigation inside infrastructure forbidden", () => {
  const probe = `
await signOutSession();
navigate({ to: "/auth" });
`;
  assert.match(probe, /signOutSession/);
  assert.match(probe, /navigate/);
});

test("shell sign-out — probe: canonical shell composition passes lexical checks", () => {
  const probe = `
import { useSignOut } from "@/features/auth";
const { signOut } = useSignOut();
const handleLogout = async () => {
  await signOut();
  navigate({ to: "/" });
};
`;
  assert.match(probe, /useSignOut[^;]*from\s+["']@\/features\/auth["']/);
  assert.match(probe, /await\s+signOut\s*\(/);
  assert.match(probe, /to\s*:\s*["']\/["']/);
  assert.doesNotMatch(probe, /@\/lib\/auth/);
  assert.doesNotMatch(probe, /auth\.signOut/);
});
