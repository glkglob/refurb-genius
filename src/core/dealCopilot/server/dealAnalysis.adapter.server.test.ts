import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/platform/sentry/server-capture", () => ({
  captureAiError: vi.fn(),
  addDiagnosticBreadcrumb: vi.fn(),
  setConversationId: vi.fn(),
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

import {
  buildSystemPrompt,
  buildUserPrompt,
  type DealAnalysisContext,
} from "./dealAnalysis.adapter.server";

const PROVIDED: DealAnalysisContext = {
  title: "Leeds terrace",
  status: "draft",
  postcode: "LS6 1AA",
  propertyType: "Terraced",
  bedrooms: 3,
  purchasePrice: 180_000,
  estimatedGdv: 250_000,
  userRefurbBudgetAssumption: 40_000,
  expectedMonthlyRent: 1_200,
  targetExitStrategy: "sell",
};

const OMITTED: DealAnalysisContext = {
  title: "Leeds terrace",
  status: "draft",
};

function combinedPrompt(ctx: DealAnalysisContext): string {
  return `${buildSystemPrompt()}\n${buildUserPrompt(ctx)}`;
}

function financialContextSection(prompt: string): string {
  const start = prompt.indexOf("User-provided financial context");
  expect(start).toBeGreaterThanOrEqual(0);
  const close = prompt.indexOf("\nThese are user-provided context", start);
  expect(close).toBeGreaterThan(start);
  return prompt.slice(start, close);
}

function lineMatching(section: string, pattern: RegExp): string {
  const line = section.split("\n").find((candidate) => pattern.test(candidate));
  expect(line).toBeDefined();
  return line!;
}

describe("deal analysis prompt financial provenance", () => {
  it("labels purchase price as a user-provided financial input", () => {
    const user = buildUserPrompt(PROVIDED);
    const financial = financialContextSection(user);
    const purchaseLine = lineMatching(financial, /Purchase price/i);

    expect(purchaseLine).toMatch(/user-provided financial input/i);
    expect(purchaseLine).toMatch(/£180,000/);
    expect(purchaseLine).not.toMatch(/underwriting assumption/i);
    expect(purchaseLine).not.toMatch(/deterministic/i);
  });

  it("labels estimated GDV as a user-provided estimate", () => {
    const user = buildUserPrompt(PROVIDED);
    const financial = financialContextSection(user);
    const gdvLine = lineMatching(financial, /Estimated GDV/i);

    expect(gdvLine).toMatch(/user-provided estimate/i);
    expect(gdvLine).toMatch(/£250,000/);
    expect(gdvLine).not.toMatch(/deterministic/i);
    expect(gdvLine).not.toMatch(/engine (output|result)/i);
  });

  it("labels userRefurbBudgetAssumption as a user-provided underwriting assumption", () => {
    const user = buildUserPrompt(PROVIDED);
    const financial = financialContextSection(user);
    const refurbLine = lineMatching(financial, /Refurb budget/i);

    expect(refurbLine).toMatch(/user-provided underwriting assumption/i);
    expect(refurbLine).toMatch(/£40,000/);
  });

  it("labels expected monthly rent as a user-provided rental / underwriting estimate", () => {
    const user = buildUserPrompt(PROVIDED);
    const financial = financialContextSection(user);
    const rentLine = lineMatching(financial, /Expected monthly rent/i);

    expect(rentLine).toMatch(/user-provided rental \/ underwriting estimate/i);
    expect(rentLine).toMatch(/£1,200/);
    expect(rentLine).not.toMatch(/deterministic/i);
  });

  it("does not present the user refurb assumption as pricing.mid_total or a deterministic pricing result", () => {
    const prompt = combinedPrompt(PROVIDED);
    const financial = financialContextSection(buildUserPrompt(PROVIDED));
    const refurbLine = lineMatching(financial, /Refurb budget/i);

    expect(refurbLine).not.toMatch(/pricing\.mid_total/i);
    expect(refurbLine).not.toMatch(/deterministic/i);
    expect(prompt).not.toMatch(/userRefurbBudgetAssumption is pricing\.mid_total/i);
    expect(prompt).not.toMatch(/refurb budget assumption is pricing\.mid_total/i);
    expect(prompt).toMatch(
      /Do not represent the user's refurb budget assumption as pricing\.mid_total/,
    );
  });

  it("does not claim the whole financial context came from the deterministic engine", () => {
    const prompt = combinedPrompt(PROVIDED);

    expect(prompt).not.toMatch(
      /Those figures come from the user's\s*deterministic engine and remain authoritative/,
    );
    expect(prompt).not.toMatch(/authoritative — provided by the user's deterministic engine/);
    expect(prompt).not.toMatch(/came from (the )?deterministic engine/i);
    expect(prompt).not.toMatch(/come from the user's deterministic engine/i);
    expect(prompt).toMatch(/Opportunity facts \(user-recorded context/);
    expect(prompt).toMatch(/User-provided financial context/);
  });

  it("states that deterministic pricing and ROI results are absent from this analysis context", () => {
    const system = buildSystemPrompt();

    expect(system).toMatch(
      /deterministic pricing and ROI results are not (present|supplied) in this analysis context/i,
    );
    expect(system).toMatch(/do not invent them/i);
  });

  it("keeps the AI advisory and forbids AI figures as system or engine authority", () => {
    const system = buildSystemPrompt();

    expect(system).toMatch(/remain advisory/i);
    expect(system).toMatch(/challenge|stress-test/i);
    expect(system).toMatch(/do not relabel/i);
    expect(system).toMatch(
      /Do not present AI-generated refurb cost, ROI, or GDV as deterministic or system authority/,
    );
  });

  it("keeps aiOpinion as an independent, non-authoritative second opinion", () => {
    const system = buildSystemPrompt();

    expect(system).toMatch(/aiOpinion/);
    expect(system).toMatch(/independent estimate/i);
    expect(system).toMatch(/non-authoritative second opinion/i);
    expect(system).toMatch(/not pricing, ROI, or system authority/i);
  });

  it("renders omitted optional values as not provided without inventing provenance", () => {
    const user = buildUserPrompt(OMITTED);
    const financial = financialContextSection(user);

    expect(financial).toMatch(/Purchase price[^:\n]*:\s*not provided/);
    expect(financial).toMatch(/Estimated GDV[^:\n]*:\s*not provided/);
    expect(financial).toMatch(/Refurb budget[^:\n]*:\s*not provided/);
    expect(financial).toMatch(/Expected monthly rent[^:\n]*:\s*not provided/);
    expect(user).toMatch(/Target exit strategy:\s*not provided/);
    expect(user).not.toMatch(/authoritative — provided by the user's deterministic engine/);
    expect(user).not.toMatch(/£/);
  });

  it("does not claim user-provided financial values cannot be ROI inputs elsewhere", () => {
    const prompt = combinedPrompt(PROVIDED);

    expect(prompt).not.toMatch(/not ROI inputs/i);
    expect(prompt).not.toMatch(/never ROI inputs/i);
    expect(prompt).not.toMatch(/not (an? )?ROI input/i);
    expect(prompt).not.toMatch(/cannot be (consumed as|used as) (deterministic )?ROI inputs?/i);
    expect(prompt).not.toMatch(/not inputs to (the )?deterministic ROI/i);
    expect(prompt).not.toMatch(/never (be )?inputs to deterministic/i);
  });

  it("keeps promptContext as additional user-supplied context, not engine output", () => {
    const user = buildUserPrompt({
      ...PROVIDED,
      promptContext: "Vendor is motivated.",
    });

    expect(user).toMatch(/Additional context from the user: Vendor is motivated\./);
    expect(user).not.toMatch(/Additional context from the (deterministic )?engine/i);
    expect(user).not.toMatch(/promptContext is (deterministic|engine)/i);
  });
});
