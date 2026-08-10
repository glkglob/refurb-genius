/**
 * PH-TRUTH CIR-TRUTH-02 — Overview money presentation wiring.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "projects.$id.index.tsx"), "utf8");

describe("Project Overview money truth (PH-TRUTH)", () => {
  it("uses formatMoneyPresence / optional money helpers for summary cards", () => {
    expect(SRC).toMatch(/formatMoneyPresence/);
    expect(SRC).toMatch(/projectOptionalMoneyForDisplay/);
    expect(SRC).toMatch(/data-testid="overview-money-summary"/);
  });

  it("does not format Money with bare toLocaleString on the value prop", () => {
    // Local Money helper must render formatMoneyPresence output, not £{value.toLocaleString()}
    expect(SRC).not.toMatch(/£\{value\.toLocaleString\(\)\}/);
  });
});
