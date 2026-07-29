/**
 * AO-1M5 — Deal opportunity edit route must not own update mutation infrastructure.
 *
 * Progressive seal: useUpdateOpportunity from @/features/deal-copilot.
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

const ROUTE = "src/routes/_authed/deal-copilot/$opportunityId.edit.tsx";
const HOOK = "src/features/deal-copilot/presentation/hooks/useUpdateOpportunity.ts";
const REPO = "src/features/deal-copilot/infrastructure/dealOpportunityRepository.ts";
const TRANSITIONAL = "src/hooks/useOpportunities.ts";
const FEATURE_API = "src/features/deal-copilot/index.ts";
const STORE = "src/core/dealCopilot/opportunityStore.ts";
const CORE_INDEX = "src/core/dealCopilot/index.ts";

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

test("deal opportunity update — feature public API exports useUpdateOpportunity", () => {
  const text = read(FEATURE_API);
  assert.match(text, /useUpdateOpportunity/, "feature root must export useUpdateOpportunity");
  assert.doesNotMatch(
    text,
    /dealOpportunityRepository|UpdateOpportunityInput/,
    "feature root must not export repository or internal input type",
  );
});

test("deal opportunity update — transitional useOpportunities no longer defines useUpdateOpportunity", () => {
  const text = read(TRANSITIONAL);
  assert.doesNotMatch(
    text,
    /function useUpdateOpportunity/,
    `${TRANSITIONAL} must not define useUpdateOpportunity`,
  );
});

test("deal opportunity update — edit route calls useUpdateOpportunity(", () => {
  const text = read(ROUTE);
  assert.match(text, /useUpdateOpportunity\s*\(/, `${ROUTE} must call useUpdateOpportunity(`);
});

test("deal opportunity update — edit route imports from @/features/deal-copilot", () => {
  const text = read(ROUTE);
  assert.match(
    text,
    /useUpdateOpportunity[^;]*from\s+["']@\/features\/deal-copilot["']/,
    `${ROUTE} must import useUpdateOpportunity from @/features/deal-copilot`,
  );
  assert.doesNotMatch(
    text,
    /useUpdateOpportunity[^;]*from\s+["']@\/hooks\/useOpportunities["']/,
    `${ROUTE} must not import useUpdateOpportunity from @/hooks/useOpportunities`,
  );
  assert.doesNotMatch(
    text,
    /presentation\/hooks\/useUpdateOpportunity/,
    `${ROUTE} must not deep-import presentation hook`,
  );
});

test("deal opportunity update — edit route bans residual update infrastructure", () => {
  const text = read(ROUTE);
  assert.doesNotMatch(text, /useMutation/, `${ROUTE} must not use useMutation`);
  assert.doesNotMatch(text, /useQueryClient/, `${ROUTE} must not use useQueryClient`);
  assert.doesNotMatch(text, /setQueryData/, `${ROUTE} must not setQueryData`);
  assert.doesNotMatch(text, /cancelQueries/, `${ROUTE} must not cancelQueries`);
  assert.doesNotMatch(
    text,
    /from\s*\(\s*["']deal_opportunities["']\s*\)/,
    `${ROUTE} must not call from("deal_opportunities")`,
  );
  assert.doesNotMatch(text, /@\/platform\/supabase/, `${ROUTE} must not import platform supabase`);
  assert.doesNotMatch(
    text,
    /dealOpportunityRepository/,
    `${ROUTE} must not import dealOpportunityRepository`,
  );
  assert.doesNotMatch(text, /analyzeDealServerFn/, `${ROUTE} must not use analyzeDealServerFn`);
  assert.doesNotMatch(text, /DealAnalysisCard/, `${ROUTE} must not own DealAnalysisCard`);
});

test("deal opportunity update — hook owns mutation composition and invalidation", () => {
  const text = read(HOOK);
  assert.match(text, /useMutation/, "hook must use useMutation");
  assert.match(text, /useQueryClient/, "hook must use useQueryClient");
  assert.match(
    text,
    /dealOpportunityRepository\.updateOpportunity|updateOpportunity/,
    "hook must call repository updateOpportunity",
  );
  assert.match(text, /\["opportunities"\]/, "hook must use literal opportunities key");
  assert.match(text, /invalidateQueries/, "hook must invalidateQueries");
  assert.doesNotMatch(text, /@\/platform\/supabase/, "hook must not import platform supabase");
  assert.doesNotMatch(
    text,
    /from\s*\(\s*["']deal_opportunities["']\s*\)/,
    "hook must not from(deal_opportunities)",
  );
  assert.doesNotMatch(text, /\.update\s*\(/, "hook must not call .update(");
  assert.doesNotMatch(text, /auth\.getUser|auth\.getSession/, "hook must not resolve auth");
  assert.doesNotMatch(text, /setQueryData/, "hook must not setQueryData");
  assert.doesNotMatch(text, /cancelQueries/, "hook must not cancelQueries");
  assert.doesNotMatch(text, /onMutate/, "hook must not use onMutate");
  assert.doesNotMatch(text, /toast\./, "hook must not toast");
  assert.doesNotMatch(text, /logger\./, "hook must not logger");
  assert.doesNotMatch(text, /navigate|useNavigate/, "hook must not navigate");
});

test("deal opportunity update — repository owns deal_opportunities update contract", () => {
  const text = read(REPO);
  assert.match(
    text,
    /from\s*\(\s*["']deal_opportunities["']\s*\)/,
    "repository must from(deal_opportunities)",
  );
  assert.match(text, /\.update\s*\(/, "repository must update");
  assert.match(text, /\.eq\s*\(\s*["']id["']/, "repository must filter eq id");
  assert.match(text, /\.select\s*\(/, "repository must select");
  assert.match(text, /\.single\s*\(/, "repository must single");
  assert.match(text, /updated_at/, "repository must write updated_at");
  assert.match(text, /listing_url/, "repository must map listing_url");
  assert.match(text, /property_type/, "repository must map property_type");
  assert.match(text, /purchase_price/, "repository must map purchase_price");
  assert.match(text, /estimated_gdv/, "repository must map estimated_gdv");
  assert.match(text, /expected_monthly_rent/, "repository must map expected_monthly_rent");
  assert.match(text, /refurb_budget/, "repository must map refurb_budget");
  assert.match(text, /target_exit_strategy/, "repository must map target_exit_strategy");
  assert.doesNotMatch(text, /auth\.getUser|auth\.getSession/, "repository must not resolve auth");
  assert.doesNotMatch(text, /\.eq\s*\(\s*["']user_id["']/, "repository must not filter user_id");
  assert.doesNotMatch(text, /upsert\s*\(/, "repository must not upsert");
  assert.doesNotMatch(text, /insert\s*\(/, "repository must not insert");
  assert.doesNotMatch(text, /useMutation|useQueryClient|QueryClient/, "repository has no RQ");
  assert.doesNotMatch(text, /toast\.|logger\./, "repository has no toast/logger");
});

test("deal opportunity update — dead store update authority removed", () => {
  const store = read(STORE);
  const core = read(CORE_INDEX);
  assert.doesNotMatch(
    store,
    /async update\s*\(|updateDealOpportunity/,
    `${STORE} must not define store update or updateDealOpportunity`,
  );
  assert.doesNotMatch(
    core,
    /updateDealOpportunity/,
    `${CORE_INDEX} must not export updateDealOpportunity`,
  );
});

test("deal opportunity update — probe: transitional update import forbidden", () => {
  const sample = `import { useUpdateOpportunity } from "@/hooks/useOpportunities";`;
  assert.match(sample, /@\/hooks\/useOpportunities/);
  assert.doesNotMatch(sample, /@\/features\/deal-copilot/);
});

test("deal opportunity update — probe: canonical composition passes", () => {
  const sample = `
import { useUpdateOpportunity } from "@/features/deal-copilot";
const updateOpportunity = useUpdateOpportunity();
updateOpportunity.mutate({ id, updates: { status } });
`;
  assert.match(sample, /useUpdateOpportunity\s*\(/);
  assert.match(sample, /@\/features\/deal-copilot/);
  assert.doesNotMatch(sample, /@\/hooks\/useOpportunities/);
});
