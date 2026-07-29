/**
 * P0-1 — Financials query must use the canonical Financial Path Normalizer.
 *
 * Scope: src/lib/queries/projects.ts Financials surface only.
 *
 * Strength: progressive lexical (comment-stripped source scan).
 * Known bypasses: alias reassignment, dynamic import string splits, computed
 * names, wrapper indirection, cross-file re-exports.
 *
 * Does not ban runRoiEngine globally — only direct use inside projects.ts.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const PROJECTS_QUERY = "src/lib/queries/projects.ts";
const NORMALIZER = "packages/services/src/financial/normalizeFinancialPath.ts";
const SERVICES_INDEX = "packages/services/src/index.ts";

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

/** Extract financialsQueryOptions body (best-effort lexical span). */
function financialsQueryBlock(source: string): string {
  const start = source.indexOf("financialsQueryOptions");
  assert.ok(start >= 0, "financialsQueryOptions must exist");
  // Span until next top-level export function/const after the query options
  const after = source.slice(start);
  const endMatch = after.search(/\nexport (?:async )?function |\nexport const optimistic/);
  return endMatch === -1 ? after : after.slice(0, endMatch);
}

test("financial path — normalizer module and package export exist", () => {
  assert.ok(existsSync(join(ROOT, NORMALIZER)), "normalizeFinancialPath.ts must exist");
  const index = read(SERVICES_INDEX);
  assert.match(index, /financial/, "packages/services public index must export financial module");
  const mod = read(NORMALIZER);
  assert.match(mod, /export function normalizeFinancialPath/, "must export normalizeFinancialPath");
  assert.match(mod, /export function calculateFinancialPath/, "must export calculateFinancialPath");
  assert.match(mod, /runRoiEngine/, "calculate path must use runRoiEngine");
});

test("financial path — projects.ts Financials uses calculateFinancialPath via @repo/services", () => {
  const source = read(PROJECTS_QUERY);
  const block = financialsQueryBlock(source);

  assert.match(
    block,
    /calculateFinancialPath/,
    "financialsQueryOptions must call calculateFinancialPath",
  );
  assert.match(
    source,
    /@repo\/services/,
    "projects.ts must import financial path from @repo/services",
  );
  assert.match(
    block,
    /import\s*\(\s*["']@repo\/services["']\s*\)|from\s+["']@repo\/services["']/,
    "Financials path must resolve calculateFinancialPath through @repo/services",
  );
});

test("financial path — projects.ts must not call runRoiEngine directly", () => {
  const source = read(PROJECTS_QUERY);
  const block = financialsQueryBlock(source);
  assert.doesNotMatch(
    block,
    /runRoiEngine\s*\(/,
    "financialsQueryOptions must not call runRoiEngine( directly",
  );
  // Whole file: no destructured runRoiEngine for Financials path
  assert.doesNotMatch(
    source,
    /runRoiEngine/,
    "projects.ts must not reference runRoiEngine after Financials migration",
  );
});

test("financial path — projects.ts must not Math.round(roi.roi)", () => {
  const source = read(PROJECTS_QUERY);
  assert.doesNotMatch(
    source,
    /Math\.round\s*\(\s*roi\.roi\s*\)/,
    "must not integer-round ROI engine result",
  );
  const block = financialsQueryBlock(source);
  assert.doesNotMatch(
    block,
    /Math\.round\s*\(\s*[^)]*roi/,
    "financialsQueryOptions must not Math.round ROI fields",
  );
});

test("financial path — canonical estimate query key preserved", () => {
  const source = read(PROJECTS_QUERY);
  assert.match(
    source,
    /estimateByProject:\s*\(projectId:\s*string\)\s*=>\s*\[\.\.\.projectKeys\.byId\(projectId\),\s*["']estimate["']\]/,
    'estimate key must remain ["projects", projectId, "estimate"] via factory',
  );
  assert.doesNotMatch(
    source,
    /["']room-estimate["']/,
    "retired room-estimate production key must not reappear",
  );
});

test("financial path — mid_total remains estimate refurb authority in Financials query", () => {
  const block = financialsQueryBlock(read(PROJECTS_QUERY));
  assert.match(block, /mid_total|midTotal/, "Financials query must pass estimate mid_total");
  assert.match(block, /getLatestRoomEstimate/, "must retain room estimate authority");
});

test("financial path — probe: residual direct runRoiEngine in Financials block forbidden", () => {
  const probe = `
export const financialsQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: projectKeys.financialsByProject(projectId),
    queryFn: async () => {
      const { runRoiEngine } = await import("@repo/services");
      const roi = runRoiEngine({ purchase_price: 1, refurb_budget: 2, estimated_gdv: 3, rental_income: 0, holding_costs: 0, region: "London", property_condition: "Average" });
      return { roiPercent: Math.round(roi.roi) };
    },
  });
`;
  assert.match(probe, /runRoiEngine\s*\(/);
  assert.match(probe, /Math\.round\s*\(\s*roi\.roi\s*\)/);
  // Live source must not match residual patterns
  const live = financialsQueryBlock(read(PROJECTS_QUERY));
  assert.doesNotMatch(live, /runRoiEngine\s*\(/);
  assert.doesNotMatch(live, /Math\.round\s*\(\s*roi\.roi\s*\)/);
});

test("financial path — probe: canonical composition passes lexical checks", () => {
  const probe = `
export const financialsQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: projectKeys.financialsByProject(projectId),
    queryFn: async () => {
      const { calculateFinancialPath } = await import("@repo/services");
      const { financials } = calculateFinancialPath({ purchase_price: 1, estimated_gdv: 2, mid_total: 3 });
      return financials;
    },
  });
`;
  assert.match(probe, /calculateFinancialPath/);
  assert.doesNotMatch(probe, /runRoiEngine\s*\(/);
  assert.doesNotMatch(probe, /Math\.round\s*\(\s*roi\.roi\s*\)/);
});
