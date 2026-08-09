/**
 * IA-8-VR-R1 — Estimate single dominant Review Scope CTA on mobile.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "projects.$id.estimate.tsx"), "utf8");

describe("Estimate Needs-attention CTA (IA-8-VR-R1)", () => {
  it("keeps sticky reconcile_scope action when scope needs review", () => {
    expect(SRC).toMatch(/actionKind:\s*nextAction\?\.actionKind\s*\?\?\s*["']reconcile_scope["']/);
    expect(SRC).toMatch(/estimate-primary-cta-sticky/);
    expect(SRC).toMatch(/href:\s*`\/projects\/\$\{id\}\/scope`/);
  });

  it("hides in-card Review Scope button on mobile (md:inline-flex only)", () => {
    expect(SRC).toMatch(/estimate-needs-attention/);
    expect(SRC).toMatch(/hidden shrink-0 md:inline-flex/);
    expect(SRC).toMatch(/estimate-review-scope-inline/);
  });

  it("uses customer-facing Scope warning without architecture language", () => {
    expect(SRC).toMatch(/Review Scope against the current Analysis and selected Redesign/);
    expect(SRC).toMatch(/before updating this[\s\S]*Estimate/);
    expect(SRC).not.toMatch(/Scope is not a separate journey stage/);
    expect(SRC).toMatch(/Needs attention/);
  });

  it("primary authority sticky is mutation-owned when Scope is current (not href-only)", () => {
    // PUBLIC-BETA-R2: MobileStickyNextAction treats href without onClick as nav-only.
    expect(SRC).toMatch(/onClick:\s*\(\)\s*=>\s*void saveCurrentEstimateAndContinue\(\)/);
    expect(SRC).toMatch(/saveCurrentEstimateAndContinue/);
  });
});
