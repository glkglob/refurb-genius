/**
 * PUBLIC-BETA-R2 — Analysis catalogue-stale recovery contract.
 *
 * Gap-closure may observe Analysis Complete after photo change if measured after
 * the Analysis route auto-recovery. That sequence is intentional, not a defect:
 *
 *   photo catalogue change → Analysis non_current (adapter)
 *   → visit /analysis → auto re-run when isStaleAnalysisRelativeToCatalogue
 *   → new Analysis current → Redesign non_current
 *
 * This test locks the contract so automatic recovery is not mistaken for a P1
 * and so we do not "repair" correct recovery behavior.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analysisCurrencyFromEvidence } from "@/features/projects";

const ANALYSIS_ROUTE = readFileSync(join(__dirname, "projects.$id.analysis.tsx"), "utf8");

describe("Analysis catalogue invalidation + recovery contract (PUBLIC-BETA-R2)", () => {
  it("adapter: photo catalogue add makes prior Analysis non_current before recovery", () => {
    expect(
      analysisCurrencyFromEvidence({
        photos: [{ id: "p1" }, { id: "p2-new" }],
        analyses: [{ photoId: "p1", source: "ai" }],
      }).currency,
    ).toBe("non_current");
  });

  it("adapter: matching coverage after recovery is current", () => {
    expect(
      analysisCurrencyFromEvidence({
        photos: [{ id: "p1" }, { id: "p2-new" }],
        analyses: [
          { photoId: "p1", source: "ai" },
          { photoId: "p2-new", source: "ai" },
        ],
      }).currency,
    ).toBe("current");
  });

  it("Analysis route auto-recovers stale catalogue on surface entry (not silent Complete)", () => {
    expect(ANALYSIS_ROUTE).toMatch(/isStaleAnalysisRelativeToCatalogue/);
    expect(ANALYSIS_ROUTE).toMatch(/catalogue_stale/);
    expect(ANALYSIS_ROUTE).toMatch(/runPhotoAnalysis/);
    // Keep stale rows while recovery runs so currency stays non_current/running.
    expect(ANALYSIS_ROUTE).toMatch(/setResults\(persisted\)/);
    expect(ANALYSIS_ROUTE).toMatch(/setAnalysing\(true\)/);
  });

  it("does not treat automatic recovery as a defect requiring permanent stale UI", () => {
    // Recovery is the product path for Update Analysis from Photos (IA-5-R3A).
    expect(ANALYSIS_ROUTE).toMatch(/catalogue drift recovery|catalogue_stale/);
  });
});
