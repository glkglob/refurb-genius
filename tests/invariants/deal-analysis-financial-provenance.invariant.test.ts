/**
 * Deal Copilot analysis financial provenance.
 *
 * Analysis must not invoke pricing/ROI engines, and the analyze path must map
 * persisted refurb_budget onto userRefurbBudgetAssumption — a user-entered
 * underwriting assumption, never pricing.mid_total.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const SERVER_FN = "src/serverFns/dealAnalysis.ts";
const ADAPTER = "src/core/dealCopilot/server/dealAnalysis.adapter.server.ts";
const CARD = "src/components/deal-copilot/DealAnalysisCard.tsx";

const FORBIDDEN_ENGINE_SYMBOLS = [
  "runPricingEngine",
  "runRoiEngine",
  "analyzeDeal",
  "isPricingAuthoritative",
] as const;

function readSource(rel: string): string {
  const path = join(ROOT, rel);
  assert.ok(existsSync(path), `${rel} must exist`);
  return readFileSync(path, "utf8");
}

test("deal analysis path and adapter do not invoke pricing or ROI engines", () => {
  const serverFn = readSource(SERVER_FN);
  const adapter = readSource(ADAPTER);

  for (const symbol of FORBIDDEN_ENGINE_SYMBOLS) {
    const pattern = new RegExp(`\\b${symbol}\\b`);
    assert.doesNotMatch(serverFn, pattern, `${SERVER_FN} must not reference ${symbol}`);
    assert.doesNotMatch(adapter, pattern, `${ADAPTER} must not reference ${symbol}`);
  }
});

test("deal analysis path maps row.refurb_budget to userRefurbBudgetAssumption", () => {
  const serverFn = readSource(SERVER_FN);

  assert.match(
    serverFn,
    /userRefurbBudgetAssumption:\s*row\.refurb_budget/,
    `${SERVER_FN} must map row.refurb_budget → userRefurbBudgetAssumption`,
  );
  assert.doesNotMatch(
    serverFn,
    /refurbBudget:\s*row/,
    `${SERVER_FN} must not pass persisted refurb_budget as DealAnalysisContext.refurbBudget`,
  );
});

test("deal analysis context field is userRefurbBudgetAssumption, not refurbBudget", () => {
  const adapter = readSource(ADAPTER);

  assert.match(
    adapter,
    /userRefurbBudgetAssumption\?: number/,
    `${ADAPTER} must declare DealAnalysisContext.userRefurbBudgetAssumption`,
  );
  assert.doesNotMatch(
    adapter,
    /refurbBudget\?: number/,
    `${ADAPTER} must not declare DealAnalysisContext.refurbBudget`,
  );
});

test("deal analysis card does not regress to false-authority copy", () => {
  const card = readSource(CARD);

  assert.doesNotMatch(
    card,
    /deterministic engine above/,
    `${CARD} must not claim a deterministic engine above`,
  );
  assert.doesNotMatch(
    card,
    /figures above remain the source of truth/,
    `${CARD} must not claim figures above remain the source of truth`,
  );
});
