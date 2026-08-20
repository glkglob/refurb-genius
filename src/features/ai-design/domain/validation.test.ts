import { describe, expect, it } from "vitest";
import { assertScopeAnalysisResult } from "./validation";

function validResult() {
  return {
    overall_score: 6,
    summary: "Average condition terrace needing a medium refresh.",
    rooms: [
      {
        room: "Kitchen",
        condition_summary: "Dated but serviceable",
        issues: [
          {
            category: "Cosmetic",
            description: "Worn units",
            severity: "medium",
            recommended_action: "Replace units",
          },
        ],
        recommended_items: [
          {
            name: "Replace mid-range kitchen units",
            category: "both",
            quantity: 1,
            unit: "room",
            base_unit_cost: 8000,
          },
        ],
      },
    ],
  };
}

describe("assertScopeAnalysisResult", () => {
  it("accepts a valid result with rooms", () => {
    const input = validResult();
    expect(assertScopeAnalysisResult(input).rooms[0]?.room).toBe("Kitchen");
  });

  it("rejects Response, wrappers, missing rooms, and non-objects", () => {
    expect(() => assertScopeAnalysisResult(new Response("<html></html>"))).toThrow(/not a result/);
    expect(() => assertScopeAnalysisResult({ data: validResult() })).toThrow(/not a result/);
    expect(() => assertScopeAnalysisResult({ overall_score: 6, summary: "x" })).toThrow(
      /not a result/,
    );
    expect(() => assertScopeAnalysisResult({ ...validResult(), rooms: [] })).toThrow(
      /not a result/,
    );
    expect(() => assertScopeAnalysisResult("[]")).toThrow(/not a result/);
  });
});
