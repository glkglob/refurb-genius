/**
 * PUBLIC-BETA-R2 — Scope must not advance to Estimate before durable authority.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "projects.$id.scope.tsx"), "utf8");

describe("Scope continue-to-estimate authority gate (PUBLIC-BETA-R2)", () => {
  it("tracks saveScopeMutation pending and requires current Scope currency", () => {
    expect(SRC).toMatch(/saveScopeMutation\.isPending/);
    expect(SRC).toMatch(/scopeAuthorityReady/);
    expect(SRC).toMatch(/scope\.currency === ["']current["']/);
    expect(SRC).toMatch(/fiveStage\.scopeId != null/);
  });

  it("disables Continue to Estimate while Scope save is pending or not current", () => {
    expect(SRC).toMatch(/disabled=\{scopeSavePending \|\| !scopeAuthorityReady\}/);
    expect(SRC).toMatch(/scope-continue-to-estimate/);
    expect(SRC).toMatch(/scope-open-estimate-builder/);
    expect(SRC).toMatch(/Saving Scope…/);
  });

  it("handleOpenEstimateBuilder refuses advancement without ready authority", () => {
    expect(SRC).toMatch(/function handleOpenEstimateBuilder/);
    expect(SRC).toMatch(/if \(scopeSavePending\)/);
    expect(SRC).toMatch(/if \(!scopeAuthorityReady\)/);
    expect(SRC).toMatch(/Scope is not saved yet/);
  });

  it("reloads five-stage workflow after durable Scope save success", () => {
    expect(SRC).toMatch(/saveScopeMutation\.mutate\(/);
    expect(SRC).toMatch(/onSuccess:\s*\(\)\s*=>\s*\{[\s\S]*?fiveStage\.reload\(\)/);
  });
});
