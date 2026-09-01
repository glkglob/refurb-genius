import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { StatusBadge } from "./StatusBadge";

const SOURCE = readFileSync(join(__dirname, "StatusBadge.tsx"), "utf8");

describe("StatusBadge", () => {
  it("keeps a Teal tint on accent chips while using readable accent text", () => {
    expect(SOURCE).toMatch(/accent:\s*"bg-accent\/10 text-accent-text border-accent\/20"/);
    expect(SOURCE).not.toMatch(/accent:\s*"[^"]*\btext-accent"/);

    const { container } = render(
      createElement(StatusBadge, { tone: "accent", children: "Analysis" }),
    );
    const chip = container.querySelector("span");
    expect(chip).toBeTruthy();
    const className = chip?.className ?? "";
    expect(className).toMatch(/\bbg-accent\/10\b/);
    expect(className).toMatch(/\bborder-accent\/20\b/);
    expect(className).toMatch(/\btext-accent-text\b/);
    expect(className).not.toMatch(/(^|[\s])text-accent([\s]|$)/);
  });

  it("does not change chip behaviour or the default tone", () => {
    const { container } = render(createElement(StatusBadge, { children: "Draft" }));
    const chip = container.querySelector("span");
    expect(chip?.textContent).toBe("Draft");
    expect(chip?.className ?? "").toMatch(/\bbg-secondary\b/);
  });

  it("uses authorised Semibold 600 without recolouring status tones", () => {
    expect(SOURCE).toMatch(/text-xs font-semibold/);
    expect(SOURCE).not.toMatch(/text-xs font-medium/);
    const { container } = render(
      createElement(StatusBadge, { tone: "accent", children: "Analysis" }),
    );
    const className = container.querySelector("span")?.className ?? "";
    expect(className).toMatch(/\bfont-semibold\b/);
    expect(className).toMatch(/\btext-accent-text\b/);
    expect(className).not.toMatch(/(^|[\s])text-accent([\s]|$)/);
  });
});
