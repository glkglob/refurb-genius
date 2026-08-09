/**
 * PUBLIC-BETA-R2 — Estimate primary continuation must persist authority before Report.
 *
 * Desktop header and mobile sticky CTA must share one stage-owned save path.
 * Mobile must not be href-only navigation to Report (that bypasses the mutation).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "projects.$id.estimate.tsx"), "utf8");

describe("Estimate primary authority continuation (PUBLIC-BETA-R2)", () => {
  it("defines a single stage-owned saveCurrentEstimateAndContinue operation", () => {
    expect(SRC).toMatch(/async function saveCurrentEstimateAndContinue/);
    expect(SRC).toMatch(/saveAuthorityCategoryEstimateServerFn/);
    expect(SRC).toMatch(/bindEstimateToScope/);
    expect(SRC).toMatch(/fiveStage\.reload\(\)/);
    expect(SRC).toMatch(/navigate\(\{\s*to:\s*["']\/projects\/\$id\/report["']/);
  });

  it("desktop primary CTA invokes shared continuation via handleReportClick", () => {
    expect(SRC).toMatch(/function handleReportClick/);
    expect(SRC).toMatch(/void saveCurrentEstimateAndContinue\(\)/);
    expect(SRC).toMatch(/estimate-primary-cta-desktop/);
    expect(SRC).toMatch(/onClick=\{handleReportClick\}/);
  });

  it("mobile sticky primary CTA uses onClick mutation, not href-only Report navigation", () => {
    // Primary authority path must pass onClick (MobileStickyNextAction: href+!onClick = nav-only).
    expect(SRC).toMatch(/onClick:\s*\(\)\s*=>\s*void saveCurrentEstimateAndContinue\(\)/);
    expect(SRC).toMatch(/testId:\s*["']estimate-primary-cta-sticky["']/);
    // Must not pair sticky authority path with bare href to report.
    const stickyBlock = SRC.slice(SRC.indexOf("stickyNextAction="), SRC.indexOf("actions="));
    expect(stickyBlock).toMatch(/onClick:\s*\(\)\s*=>\s*void saveCurrentEstimateAndContinue/);
    // When not needsScopeReconcile, sticky must not be href-only to report.
    expect(stickyBlock).not.toMatch(
      /href:\s*nextAction\?\.route\s*\?\?\s*`\/projects\/\$\{id\}\/report`/,
    );
  });

  it("does not navigate to Report when Scope bind is missing or fails", () => {
    expect(SRC).toMatch(/if \(!fiveStage\.scopeId\)/);
    expect(SRC).toMatch(/Review Scope before treating this Estimate as current/);
    expect(SRC).toMatch(/could not bind to current Scope/);
    // After bind failure: reload and return (no navigate).
    expect(SRC).toMatch(/catch \(bindErr\)[\s\S]*?await fiveStage\.reload\(\);\s*return;/);
  });

  it("guards against duplicate concurrent primary continuations", () => {
    expect(SRC).toMatch(/authoritySaveInFlightRef/);
    expect(SRC).toMatch(/if \(authoritySaveInFlightRef\.current\) return/);
    expect(SRC).toMatch(/authoritySaving/);
  });

  it("uses REFERENCE_SIZE_SQM when project size is missing or zero (name-only projects)", () => {
    // Project create allows optional size_sqm=0; authority decoder requires size > 0.
    expect(SRC).toMatch(/REFERENCE_SIZE_SQM/);
    expect(SRC).toMatch(/estimateSizeSqm/);
    expect(SRC).toMatch(/property_size_sqm:\s*estimateSizeSqm/);
  });

  it("orders success path as save → bind → reload → navigate", () => {
    const fnStart = SRC.indexOf("async function saveCurrentEstimateAndContinue");
    const fnBody = SRC.slice(fnStart, SRC.indexOf("function handleReportClick"));
    const saveIdx = fnBody.indexOf("saveAuthorityCategoryEstimateServerFn");
    const bindIdx = fnBody.indexOf("bindEstimateToScope");
    // Success-path reload is the one immediately before navigate (error paths also reload).
    const navIdx = fnBody.indexOf('navigate({ to: "/projects/$id/report"');
    const reloadBeforeNav = fnBody.lastIndexOf("await fiveStage.reload()", navIdx);
    expect(saveIdx).toBeGreaterThan(-1);
    expect(bindIdx).toBeGreaterThan(saveIdx);
    expect(reloadBeforeNav).toBeGreaterThan(bindIdx);
    expect(navIdx).toBeGreaterThan(reloadBeforeNav);
  });
});
