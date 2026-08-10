import { describe, expect, it } from "vitest";

import {
  MONEY_NOT_SET_LABEL,
  formatMoneyPresence,
  projectOptionalMoneyForDisplay,
} from "./money-display";

describe("formatMoneyPresence", () => {
  it("maps null/undefined/NaN to Not set", () => {
    expect(formatMoneyPresence(null)).toBe(MONEY_NOT_SET_LABEL);
    expect(formatMoneyPresence(undefined)).toBe(MONEY_NOT_SET_LABEL);
    expect(formatMoneyPresence(Number.NaN)).toBe(MONEY_NOT_SET_LABEL);
  });

  it("maps authoritative zero to £0", () => {
    expect(formatMoneyPresence(0)).toBe("£0");
  });

  it("formats positive values as currency", () => {
    expect(formatMoneyPresence(250_000)).toBe("£250,000");
    expect(formatMoneyPresence(64_500)).toBe("£64,500");
  });
});

describe("projectOptionalMoneyForDisplay", () => {
  it("treats stored zero as unset for name-only optional base money", () => {
    expect(projectOptionalMoneyForDisplay(0)).toBeNull();
    expect(formatMoneyPresence(projectOptionalMoneyForDisplay(0))).toBe(MONEY_NOT_SET_LABEL);
  });

  it("preserves positive authoritative amounts", () => {
    expect(projectOptionalMoneyForDisplay(285_000)).toBe(285_000);
    expect(formatMoneyPresence(projectOptionalMoneyForDisplay(285_000))).toBe("£285,000");
  });

  it("passes null/undefined through as unset", () => {
    expect(projectOptionalMoneyForDisplay(null)).toBeNull();
    expect(projectOptionalMoneyForDisplay(undefined)).toBeNull();
  });
});
