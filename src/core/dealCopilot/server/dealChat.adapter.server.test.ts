import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/platform/sentry/server-capture", () => ({
  captureAiError: vi.fn(),
  addDiagnosticBreadcrumb: vi.fn(),
}));
vi.mock("@/platform/openai/server", () => ({
  getOpenAIClient: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/timeout", () => ({
  timeoutPromise: vi.fn(async (p: Promise<unknown>) => p),
}));

import { buildSystemPrompt, type DealChatContext } from "./dealChat.adapter.server";

const PROVIDED: DealChatContext = {
  opportunityTitle: "Leeds terrace",
  opportunityStatus: "draft",
  postcode: "LS6 1AA",
  propertyType: "Terraced",
  bedrooms: 3,
  purchasePrice: 180_000,
  estimatedGdv: 250_000,
  userRefurbBudgetAssumption: 40_000,
};

const OMITTED: DealChatContext = {
  opportunityTitle: "Leeds terrace",
  opportunityStatus: "draft",
};

function financialContextSection(prompt: string): string {
  const start = prompt.indexOf("User-provided financial context");
  expect(start).toBeGreaterThanOrEqual(0);
  const rules = prompt.indexOf("\nRules:", start);
  expect(rules).toBeGreaterThan(start);
  return prompt.slice(start, rules);
}

function lineMatching(section: string, pattern: RegExp): string {
  const line = section.split("\n").find((candidate) => pattern.test(candidate));
  expect(line).toBeDefined();
  return line!;
}

describe("buildSystemPrompt financial provenance", () => {
  it("labels purchase price as a user-provided financial input", () => {
    const prompt = buildSystemPrompt(PROVIDED);
    const financial = financialContextSection(prompt);
    const purchaseLine = lineMatching(financial, /Purchase price/i);

    expect(purchaseLine).toMatch(/user-provided financial input/i);
    expect(purchaseLine).toMatch(/£180,000/);
    expect(purchaseLine).not.toMatch(/underwriting assumption/i);
    expect(purchaseLine).not.toMatch(/deterministic/i);
  });

  it("labels estimated GDV as a user-provided estimate", () => {
    const prompt = buildSystemPrompt(PROVIDED);
    const financial = financialContextSection(prompt);
    const gdvLine = lineMatching(financial, /Estimated GDV/i);

    expect(gdvLine).toMatch(/user-provided estimate/i);
    expect(gdvLine).toMatch(/£250,000/);
    expect(gdvLine).not.toMatch(/deterministic/i);
    expect(gdvLine).not.toMatch(/engine (output|result)/i);
  });

  it("labels userRefurbBudgetAssumption as a user-provided underwriting assumption", () => {
    const prompt = buildSystemPrompt(PROVIDED);
    const financial = financialContextSection(prompt);
    const refurbLine = lineMatching(financial, /Refurb budget/i);

    expect(refurbLine).toMatch(/user-provided underwriting assumption/i);
    expect(refurbLine).toMatch(/£40,000/);
  });

  it("does not present the user refurb assumption as pricing.mid_total or a deterministic pricing result", () => {
    const prompt = buildSystemPrompt(PROVIDED);
    const financial = financialContextSection(prompt);
    const refurbLine = lineMatching(financial, /Refurb budget/i);

    expect(refurbLine).not.toMatch(/pricing\.mid_total/i);
    expect(refurbLine).not.toMatch(/deterministic/i);
    expect(prompt).not.toMatch(/userRefurbBudgetAssumption is pricing\.mid_total/i);
    expect(prompt).not.toMatch(/refurb budget assumption is pricing\.mid_total/i);
  });

  it("does not claim the whole opportunity context came from the deterministic engine", () => {
    const prompt = buildSystemPrompt(PROVIDED);

    expect(prompt).not.toMatch(
      /Opportunity context \(authoritative — provided by the user's deterministic engine\)/,
    );
    expect(prompt).not.toMatch(/authoritative — provided by the user's deterministic engine/);
    expect(prompt).toMatch(/Opportunity facts \(user-recorded metadata/);
    expect(prompt).not.toMatch(/came from (the )?deterministic engine/i);
  });

  it("does not claim user-provided financial values are not ROI inputs", () => {
    const prompt = buildSystemPrompt(PROVIDED);

    expect(prompt).not.toMatch(/not ROI inputs/i);
    expect(prompt).not.toMatch(/never ROI inputs/i);
    expect(prompt).not.toMatch(/not (an? )?ROI input/i);
    expect(prompt).not.toMatch(/cannot be (consumed as|used as) (deterministic )?ROI inputs?/i);
    expect(prompt).not.toMatch(/not inputs to (the )?deterministic ROI/i);
    expect(prompt).not.toMatch(/never (be )?inputs to deterministic/i);
  });

  it("states that deterministic pricing and ROI results are not supplied in this chat context", () => {
    const prompt = buildSystemPrompt(PROVIDED);

    expect(prompt).toMatch(
      /deterministic pricing and ROI results are not (present|supplied) in this chat context/i,
    );
    expect(prompt).toMatch(/do not invent them/i);
  });

  it("keeps the AI advisory and forbids substitute financials as system or engine authority", () => {
    const prompt = buildSystemPrompt(PROVIDED);

    expect(prompt).toMatch(/remain advisory/i);
    expect(prompt).toMatch(/challenge|stress-test/i);
    expect(prompt).toMatch(/do not relabel/i);
    expect(prompt).toMatch(
      /do not present a substitute refurb cost, ROI, or GDV as system or engine authority/i,
    );
    expect(prompt).not.toMatch(/Never recompute or override the user's financial figures above/);
  });

  it("renders omitted financial values as not provided without inventing provenance", () => {
    const prompt = buildSystemPrompt(OMITTED);
    const financial = financialContextSection(prompt);

    expect(financial).toMatch(/Purchase price[^:\n]*:\s*not provided/);
    expect(financial).toMatch(/Estimated GDV[^:\n]*:\s*not provided/);
    expect(financial).toMatch(/Refurb budget[^:\n]*:\s*not provided/);
    expect(prompt).not.toMatch(/authoritative — provided by the user's deterministic engine/);
    expect(prompt).not.toMatch(/£/);
  });
});
