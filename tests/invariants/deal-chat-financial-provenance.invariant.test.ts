/**
 * Deal Copilot chat financial provenance.
 *
 * Chat must not invoke pricing/ROI/analyzeDeal, and the send path must map
 * persisted refurb_budget onto userRefurbBudgetAssumption — a user-entered
 * underwriting assumption, never pricing.mid_total.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const SERVER_FN = "src/serverFns/dealChat.ts";
const ADAPTER = "src/core/dealCopilot/server/dealChat.adapter.server.ts";

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

test("deal chat send path and adapter do not invoke pricing or ROI engines", () => {
  const serverFn = readSource(SERVER_FN);
  const adapter = readSource(ADAPTER);

  for (const symbol of FORBIDDEN_ENGINE_SYMBOLS) {
    const pattern = new RegExp(`\\b${symbol}\\b`);
    assert.doesNotMatch(serverFn, pattern, `${SERVER_FN} must not reference ${symbol}`);
    assert.doesNotMatch(adapter, pattern, `${ADAPTER} must not reference ${symbol}`);
  }
});

test("deal chat send path maps opp.refurb_budget to userRefurbBudgetAssumption", () => {
  const serverFn = readSource(SERVER_FN);

  assert.match(
    serverFn,
    /userRefurbBudgetAssumption:\s*opp\.refurb_budget/,
    `${SERVER_FN} must map opp.refurb_budget → userRefurbBudgetAssumption`,
  );
  assert.doesNotMatch(
    serverFn,
    /refurbBudget:\s*opp/,
    `${SERVER_FN} must not pass persisted refurb_budget as DealChatContext.refurbBudget`,
  );
});

test("deal chat context field is userRefurbBudgetAssumption, not refurbBudget", () => {
  const adapter = readSource(ADAPTER);

  assert.match(
    adapter,
    /userRefurbBudgetAssumption\?: number/,
    `${ADAPTER} must declare DealChatContext.userRefurbBudgetAssumption`,
  );
  assert.doesNotMatch(
    adapter,
    /refurbBudget\?: number/,
    `${ADAPTER} must not declare DealChatContext.refurbBudget`,
  );
});
