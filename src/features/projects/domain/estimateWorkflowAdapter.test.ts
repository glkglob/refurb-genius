import { describe, expect, it } from "vitest";
import { estimateCurrencyFromEvidence } from "./estimateWorkflowAdapter";

describe("estimateCurrencyFromEvidence", () => {
  it("absent when scope current and no estimate", () => {
    expect(
      estimateCurrencyFromEvidence({
        scopeCurrency: "current",
        currentScopeId: "scope-1",
        estimate: null,
      }).currency,
    ).toBe("absent");
  });

  it("current when bound to current scope", () => {
    expect(
      estimateCurrencyFromEvidence({
        scopeCurrency: "current",
        currentScopeId: "scope-1",
        estimate: { id: "est-1", inputScopeId: "scope-1" },
      }).currency,
    ).toBe("current");
  });

  it("non_current when scope advanced", () => {
    expect(
      estimateCurrencyFromEvidence({
        scopeCurrency: "current",
        currentScopeId: "scope-2",
        estimate: { id: "est-1", inputScopeId: "scope-1" },
      }).currency,
    ).toBe("non_current");
  });

  it("non_current for legacy unbound estimate when scope current", () => {
    expect(
      estimateCurrencyFromEvidence({
        scopeCurrency: "current",
        currentScopeId: "scope-1",
        estimate: { id: "est-1", inputScopeId: null },
      }).currency,
    ).toBe("non_current");
  });

  it("draft never current", () => {
    expect(
      estimateCurrencyFromEvidence({
        scopeCurrency: "current",
        currentScopeId: "scope-1",
        estimate: { id: "est-1", inputScopeId: "scope-1", isDraft: true },
      }).currency,
    ).toBe("absent");
  });
});
