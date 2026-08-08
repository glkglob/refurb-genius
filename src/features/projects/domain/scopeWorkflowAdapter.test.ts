import { describe, expect, it } from "vitest";
import { scopeCurrencyFromEvidence } from "./scopeWorkflowAdapter";

describe("scopeCurrencyFromEvidence", () => {
  const base = {
    analysisCurrency: "current" as const,
    redesignCurrency: "current" as const,
    currentAnalysisIdentity: "photo-a",
    currentSelectedRedesignIdentity: "redesign-1",
  };

  it("absent when no scope", () => {
    expect(scopeCurrencyFromEvidence({ ...base, scope: null }).currency).toBe("absent");
  });

  it("current when identities match", () => {
    expect(
      scopeCurrencyFromEvidence({
        ...base,
        scope: {
          id: "scope-1",
          analysisIdentity: "photo-a",
          redesignIdentity: "redesign-1",
        },
      }).currency,
    ).toBe("current");
  });

  it("non_current when redesign changed", () => {
    expect(
      scopeCurrencyFromEvidence({
        ...base,
        currentSelectedRedesignIdentity: "redesign-2",
        scope: {
          id: "scope-1",
          analysisIdentity: "photo-a",
          redesignIdentity: "redesign-1",
        },
      }).currency,
    ).toBe("non_current");
  });

  it("non_current for legacy unstamped scope when redesign current", () => {
    expect(
      scopeCurrencyFromEvidence({
        ...base,
        scope: {
          id: "scope-1",
          analysisIdentity: "",
          redesignIdentity: "",
        },
      }).currency,
    ).toBe("non_current");
  });

  it("running when operation in flight", () => {
    expect(
      scopeCurrencyFromEvidence({
        ...base,
        scope: null,
        scopeOperationRunning: true,
      }).currency,
    ).toBe("running");
  });
});
