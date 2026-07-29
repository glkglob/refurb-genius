/**
 * AO-1M6 — DealAnalysisCard must not own analysis mutation infrastructure.
 *
 * Progressive seal: useAnalyzeDealOpportunity from @/features/deal-copilot.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment, dynamic import string splits, computed property names,
 * wrapper indirection.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

const CARD = "src/components/deal-copilot/DealAnalysisCard.tsx";
const HOOK = "src/features/deal-copilot/presentation/hooks/useAnalyzeDealOpportunity.ts";
const FEATURE_API = "src/features/deal-copilot/index.ts";

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

test("deal analysis card — feature public API exports useAnalyzeDealOpportunity", () => {
  const text = read(FEATURE_API);
  assert.match(
    text,
    /useAnalyzeDealOpportunity/,
    "feature root must export useAnalyzeDealOpportunity",
  );
  assert.match(text, /useUpdateOpportunity/, "feature root must retain AO-1M5 update export");
  assert.doesNotMatch(
    text,
    /analyzeDealServerFn|runDealAnalysis|dealAnalysisSchema/,
    "feature root must not export server analysis internals",
  );
});

test("deal analysis card — card imports useAnalyzeDealOpportunity from @/features/deal-copilot", () => {
  const text = read(CARD);
  assert.match(
    text,
    /useAnalyzeDealOpportunity[^;]*from\s+["']@\/features\/deal-copilot["']/,
    `${CARD} must import useAnalyzeDealOpportunity from @/features/deal-copilot`,
  );
  assert.match(
    text,
    /useAnalyzeDealOpportunity\s*\(/,
    `${CARD} must call useAnalyzeDealOpportunity(`,
  );
  assert.match(text, /\.mutate\s*\(/, `${CARD} must call .mutate(`);
  assert.match(text, /opportunityId/, `${CARD} must pass opportunityId`);
  assert.match(text, /isPending/, `${CARD} must use isPending`);
  assert.match(text, /isError/, `${CARD} must use isError`);
  assert.match(text, /\.data/, `${CARD} must use mutation data`);
});

test("deal analysis card — card bans residual mutation infrastructure", () => {
  const text = read(CARD);
  assert.doesNotMatch(
    text,
    /from\s+["']@tanstack\/react-query["']/,
    `${CARD} must not import from @tanstack/react-query`,
  );
  assert.doesNotMatch(text, /useMutation/, `${CARD} must not use useMutation`);
  assert.doesNotMatch(
    text,
    /analyzeDealServerFn/,
    `${CARD} must not reference analyzeDealServerFn`,
  );
  assert.doesNotMatch(
    text,
    /@\/serverFns\/dealAnalysis/,
    `${CARD} must not import @/serverFns/dealAnalysis`,
  );
  assert.doesNotMatch(
    text,
    /trackEvent\s*\(\s*["']deal_analyzed["']/,
    `${CARD} must not emit deal_analyzed analytics`,
  );
  assert.doesNotMatch(text, /@\/lib\/analytics/, `${CARD} must not import @/lib/analytics`);
  assert.doesNotMatch(text, /@\/platform\/supabase/, `${CARD} must not import platform supabase`);
  assert.doesNotMatch(text, /useQueryClient/, `${CARD} must not use useQueryClient`);
  assert.doesNotMatch(text, /invalidateQueries/, `${CARD} must not invalidateQueries`);
  assert.doesNotMatch(text, /setQueryData/, `${CARD} must not setQueryData`);
  assert.doesNotMatch(text, /cancelQueries/, `${CARD} must not cancelQueries`);
  assert.doesNotMatch(
    text,
    /presentation\/hooks\/useAnalyzeDealOpportunity/,
    `${CARD} must not deep-import presentation hook`,
  );
});

test("deal analysis card — hook owns mutation, serverFn, and success analytics", () => {
  const text = read(HOOK);
  assert.match(text, /useMutation/, "hook must use useMutation");
  assert.match(text, /analyzeDealServerFn/, "hook must call analyzeDealServerFn");
  assert.match(
    text,
    /trackEvent\s*\(\s*["']deal_analyzed["']/,
    "hook must track deal_analyzed on success",
  );
  assert.match(text, /onSuccess/, "hook must use onSuccess for analytics");
  assert.match(text, /opportunityId/, "hook must accept opportunityId");
  assert.match(text, /promptContext/, "hook must support optional promptContext");
});

test("deal analysis card — hook bans QueryClient and browser Supabase", () => {
  const text = read(HOOK);
  assert.doesNotMatch(text, /useQueryClient/, "hook must not use useQueryClient");
  assert.doesNotMatch(text, /invalidateQueries/, "hook must not invalidateQueries");
  assert.doesNotMatch(text, /setQueryData/, "hook must not setQueryData");
  assert.doesNotMatch(text, /cancelQueries/, "hook must not cancelQueries");
  assert.doesNotMatch(text, /@\/platform\/supabase/, "hook must not import platform supabase");
  assert.doesNotMatch(text, /from\s*\(\s*["']deal_opportunities["']/, "hook must not query table");
  assert.doesNotMatch(text, /toast\./, "hook must not toast");
  assert.doesNotMatch(text, /logger\./, "hook must not logger");
  assert.doesNotMatch(text, /navigate|useNavigate/, "hook must not navigate");
});

test("deal analysis card — probe: direct useMutation in card forbidden", () => {
  const sample = `import { useMutation } from "@tanstack/react-query";`;
  assert.match(sample, /useMutation/);
  assert.doesNotMatch(sample, /useAnalyzeDealOpportunity/);
});

test("deal analysis card — probe: direct serverFn import in card forbidden", () => {
  const sample = `import { analyzeDealServerFn } from "@/serverFns/dealAnalysis";`;
  assert.match(sample, /@\/serverFns\/dealAnalysis/);
  assert.doesNotMatch(sample, /@\/features\/deal-copilot/);
});

test("deal analysis card — probe: canonical composition passes", () => {
  const sample = `
import { useAnalyzeDealOpportunity } from "@/features/deal-copilot";
const mutation = useAnalyzeDealOpportunity();
mutation.mutate({ opportunityId });
`;
  assert.match(sample, /useAnalyzeDealOpportunity\s*\(/);
  assert.match(sample, /@\/features\/deal-copilot/);
  assert.doesNotMatch(sample, /useMutation/);
  assert.doesNotMatch(sample, /analyzeDealServerFn/);
});
