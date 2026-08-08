import { describe, expect, it } from "vitest";
import { exportCurrencyFromEvidence } from "./exportWorkflowAdapter";

describe("exportCurrencyFromEvidence", () => {
  it("absent without snapshot", () => {
    expect(
      exportCurrencyFromEvidence({
        estimateCurrency: "current",
        currentEstimateId: "est-1",
        snapshot: null,
      }).currency,
    ).toBe("absent");
  });

  it("current when snapshot matches estimate", () => {
    expect(
      exportCurrencyFromEvidence({
        estimateCurrency: "current",
        currentEstimateId: "est-1",
        snapshot: { id: "snap-1", estimateId: "est-1" },
      }).currency,
    ).toBe("current");
  });

  it("non_current when estimate advanced", () => {
    expect(
      exportCurrencyFromEvidence({
        estimateCurrency: "current",
        currentEstimateId: "est-2",
        snapshot: { id: "snap-1", estimateId: "est-1" },
      }).currency,
    ).toBe("non_current");
  });

  it("does not treat download-less page as complete", () => {
    // No snapshot → absent even if estimate current (report_done ignored).
    expect(
      exportCurrencyFromEvidence({
        estimateCurrency: "current",
        currentEstimateId: "est-1",
        snapshot: null,
      }).currency,
    ).not.toBe("current");
  });
});
