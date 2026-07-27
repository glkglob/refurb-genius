/**
 * AO-1D1 — Admin route must not own platform Supabase metrics reads.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment of a Supabase client imported under another name, dynamic
 * import strings split across concatenations.
 *
 * Requires the three canonical admin metrics hooks.
 * Bans platform Supabase, direct .from(, and retired inline loaders in the route.
 * Allows RequireAdmin, AIMetricsDashboard, presentation mapping, UI.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const ROUTE = "src/routes/_authed/admin.tsx";
const HOOKS = "src/features/admin/presentation/hooks/useAdminMetrics.ts";
const READS = "src/features/admin/infrastructure/adminMetricsRead.ts";

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

test("admin metrics — AdminPage calls three canonical hooks", () => {
  const full = join(ROOT, ROUTE);
  assert.ok(existsSync(full), `missing ${ROUTE}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /useAdminPlatformStats\s*\(/, `${ROUTE} must call useAdminPlatformStats(`);
  assert.match(text, /useAdminRecentProjects\s*\(/, `${ROUTE} must call useAdminRecentProjects(`);
  assert.match(text, /useAdminUsers\s*\(/, `${ROUTE} must call useAdminUsers(`);
});

test("admin metrics — AdminPage bans platform Supabase and direct .from", () => {
  const text = stripAllComments(readFileSync(join(ROOT, ROUTE), "utf8"));
  assert.doesNotMatch(text, /@\/platform\/supabase/, `${ROUTE} must not import platform supabase`);
  assert.doesNotMatch(text, /\.from\s*\(/, `${ROUTE} must not call .from(`);
  assert.doesNotMatch(text, /loadPlatformStats/, `${ROUTE} must not define loadPlatformStats`);
  assert.doesNotMatch(text, /loadRecentProjects/, `${ROUTE} must not define loadRecentProjects`);
  assert.doesNotMatch(text, /loadUsers/, `${ROUTE} must not define loadUsers`);
  assert.doesNotMatch(text, /useEffect/, `${ROUTE} must not use useEffect for metrics load`);
});

test("admin metrics — hooks wrap three independent query options", () => {
  const full = join(ROOT, HOOKS);
  assert.ok(existsSync(full), `missing ${HOOKS}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /adminPlatformStatsQueryOptions/);
  assert.match(text, /adminRecentProjectsQueryOptions/);
  assert.match(text, /adminUsersQueryOptions/);
  assert.doesNotMatch(text, /useMutation|useQueryClient|useQueries/);
  assert.doesNotMatch(text, /@\/platform\/supabase/);
});

test("admin metrics — infrastructure owns Supabase reads and soft failures", () => {
  const full = join(ROOT, READS);
  assert.ok(existsSync(full), `missing ${READS}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /fetchAdminPlatformStats/);
  assert.match(text, /fetchAdminRecentProjects/);
  assert.match(text, /fetchAdminUsers/);
  assert.match(text, /@\/platform\/supabase\/browser/);
  assert.match(text, /count:\s*["']exact["']/);
  assert.match(text, /head:\s*true/);
  assert.match(text, /\.limit\s*\(\s*5\s*\)/);
  assert.match(text, /\.limit\s*\(\s*10\s*\)/);
  assert.doesNotMatch(text, /useQuery|useMutation|QueryClient|toast|useAuth/);
  assert.doesNotMatch(text, /\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(/);
});

test("admin metrics — probe: residual platform supabase in route is forbidden", () => {
  const sample = `import { supabase } from "@/platform/supabase/browser";
supabase.from("projects");
`;
  assert.match(sample, /@\/platform\/supabase/);
  assert.match(sample, /\.from\s*\(/);
});

test("admin metrics — probe: string-only hook name does not satisfy call", () => {
  const sample = `const useAdminPlatformStats = "fake";`;
  assert.match(sample, /useAdminPlatformStats/);
  assert.doesNotMatch(sample, /useAdminPlatformStats\s*\(/);
});
