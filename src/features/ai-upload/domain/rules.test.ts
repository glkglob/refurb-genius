import { describe, it, expect } from "vitest";
import type { RoomAnalysis } from "./types";
import {
  needsHumanReview,
  isRetryableAnalysis,
  photoAiStatus,
  groupAnalysesByRoom,
  findDuplicatePhotoIds,
  suggestWithoutOverwrite,
  CONFIDENCE_REVIEW_THRESHOLD,
  isSuccessfulAnalysis,
  hasFallbackResults,
  mergeAnalysesRetainingGood,
  hasMockAnalysis,
  isMockOnlyAnalysisSet,
  isStaleAnalysisRelativeToCatalogue,
  isProductionValidAnalysisSet,
  assertAnalysisProvenance,
  PHOTO_ANALYSIS_MOCK_FORBIDDEN,
} from "./rules";

function analysis(partial: Partial<RoomAnalysis> & Pick<RoomAnalysis, "id">): RoomAnalysis {
  return {
    photo_url: `https://u/${partial.id}`,
    photo_name: `${partial.id}.jpg`,
    room_type: "Kitchen",
    condition_level: "Average",
    refurbishment_level: "Medium",
    visible_issues: [],
    recommended_works: [],
    ai_summary: "ok",
    confidence_score: 0.9,
    source: "ai",
    ...partial,
  };
}

describe("ai-upload domain rules", () => {
  it("flags low confidence and fallback for human review", () => {
    expect(needsHumanReview(analysis({ id: "a", confidence_score: 0.9 }))).toBe(false);
    expect(
      needsHumanReview(analysis({ id: "b", confidence_score: CONFIDENCE_REVIEW_THRESHOLD - 0.01 })),
    ).toBe(true);
    expect(needsHumanReview(analysis({ id: "c", source: "fallback", confidence_score: 0 }))).toBe(
      true,
    );
  });

  it("maps photo AI status", () => {
    expect(photoAiStatus(undefined)).toBe("pending");
    expect(photoAiStatus(analysis({ id: "a", source: "fallback", confidence_score: 0 }))).toBe(
      "fallback",
    );
    expect(photoAiStatus(analysis({ id: "b", confidence_score: 0.9 }))).toBe("analysed");
    expect(photoAiStatus(analysis({ id: "c", confidence_score: 0.2 }))).toBe("needs_review");
  });

  it("groups analyses by room type in first-seen order", () => {
    const groups = groupAnalysesByRoom([
      analysis({ id: "1", room_type: "Bathroom" }),
      analysis({ id: "2", room_type: "Kitchen" }),
      analysis({ id: "3", room_type: "Bathroom" }),
    ]);
    expect(groups.map((g) => g.roomType)).toEqual(["Bathroom", "Kitchen"]);
    expect(groups[0]?.analyses).toHaveLength(2);
    expect(groups[1]?.analyses).toHaveLength(1);
  });

  it("detects duplicate photos by name+size", () => {
    const dups = findDuplicatePhotoIds([
      { id: "a", name: "room.jpg", size: 100 },
      { id: "b", name: "room.jpg", size: 100 },
      { id: "c", name: "room.jpg", size: 200 },
    ]);
    expect(dups).toEqual(["b"]);
  });

  it("suggestWithoutOverwrite never clobbers user values", () => {
    expect(suggestWithoutOverwrite("", "AI kitchen")).toEqual({
      value: "AI kitchen",
      suggestion: null,
      applied: true,
    });
    expect(suggestWithoutOverwrite("User kitchen", "AI kitchen")).toEqual({
      value: "User kitchen",
      suggestion: "AI kitchen",
      applied: false,
    });
  });

  it("success / fallback helpers", () => {
    const ok = analysis({ id: "ok" });
    const fb = analysis({ id: "fb", source: "fallback", confidence_score: 0 });
    expect(isSuccessfulAnalysis(ok)).toBe(true);
    expect(isSuccessfulAnalysis(fb)).toBe(false);
    expect(hasFallbackResults([ok, fb])).toBe(true);
    expect(isRetryableAnalysis(fb)).toBe(true);
  });

  it("treats empty/whitespace summary as needs review and retryable", () => {
    const empty = analysis({ id: "e", confidence_score: 0.95, ai_summary: "" });
    const space = analysis({ id: "s", confidence_score: 0.95, ai_summary: "   " });
    const good = analysis({ id: "g", confidence_score: 0.95, ai_summary: "Solid kitchen." });
    expect(needsHumanReview(empty)).toBe(true);
    expect(isRetryableAnalysis(empty)).toBe(true);
    expect(needsHumanReview(space)).toBe(true);
    expect(isRetryableAnalysis(space)).toBe(true);
    expect(needsHumanReview(good)).toBe(false);
    expect(isRetryableAnalysis(good)).toBe(false);
  });

  it("keeps needsHumanReview and isRetryableAnalysis identical", () => {
    const fixtures = [
      analysis({ id: "1", confidence_score: 0.9 }),
      analysis({ id: "2", confidence_score: 0.1 }),
      analysis({ id: "3", source: "fallback", confidence_score: 0 }),
      analysis({ id: "4", source: "mock", confidence_score: 0.9 }),
      analysis({ id: "5", confidence_score: 0.9, ai_summary: "" }),
      analysis({ id: "6", confidence_score: 0.9, ai_summary: "  " }),
    ];
    for (const f of fixtures) {
      expect(isRetryableAnalysis(f)).toBe(needsHumanReview(f));
    }
  });

  it("mergeAnalysesRetainingGood retains good rows and overwrites keys", () => {
    const existing = [
      analysis({ id: "good", photo_url: "https://u/good", confidence_score: 0.9 }),
      analysis({
        id: "weak",
        photo_url: "https://u/weak",
        source: "fallback",
        confidence_score: 0,
      }),
    ];
    const refreshed = [
      analysis({
        id: "weak2",
        photo_url: "https://u/weak",
        confidence_score: 0.85,
        ai_summary: "Better",
      }),
    ];
    const merged = mergeAnalysesRetainingGood(existing, refreshed);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.photo_url).toBe("https://u/good");
    expect(merged[0]?.confidence_score).toBe(0.9);
    expect(merged[1]?.ai_summary).toBe("Better");
  });

  it("E: existing mock Kitchen/Bathroom/Living Room + 3 real photos is stale", () => {
    const mockSet = [
      analysis({
        id: "fallback-0",
        source: "mock",
        room_type: "Kitchen",
        photo_url: "/assets/before.jpg",
        photo_name: "fallback-living.jpg",
      }),
      analysis({
        id: "fallback-1",
        source: "mock",
        room_type: "Bathroom",
        photo_url: "/assets/after.jpg",
        photo_name: "fallback-kitchen.jpg",
      }),
      analysis({
        id: "fallback-2",
        source: "mock",
        room_type: "Living Room",
        photo_url: "/assets/hero-after.jpg",
        photo_name: "fallback-exterior.jpg",
      }),
    ];
    const catalogue = [
      { id: "r1", url: "https://cdn/r1.jpg", name: "one.jpg" },
      { id: "r2", url: "https://cdn/r2.jpg", name: "two.jpg" },
      { id: "r3", url: "https://cdn/r3.jpg", name: "three.jpg" },
    ];
    expect(hasMockAnalysis(mockSet)).toBe(true);
    expect(isMockOnlyAnalysisSet(mockSet)).toBe(true);
    expect(isStaleAnalysisRelativeToCatalogue(mockSet, catalogue)).toBe(true);
    expect(isProductionValidAnalysisSet(mockSet, catalogue)).toBe(false);
  });

  it("detects catalogue photos absent from analysis set as stale", () => {
    const analyses = [
      analysis({ id: "r1", photo_url: "https://cdn/r1.jpg", photo_name: "one.jpg" }),
    ];
    const catalogue = [
      { id: "r1", url: "https://cdn/r1.jpg", name: "one.jpg" },
      { id: "r2", url: "https://cdn/r2.jpg", name: "two.jpg" },
    ];
    expect(isStaleAnalysisRelativeToCatalogue(analyses, catalogue)).toBe(true);
  });

  it("assertAnalysisProvenance rejects mock and cardinality mismatches", () => {
    const photos = [{ id: "p1", url: "https://cdn/p1.jpg", name: "a.jpg" }];
    try {
      assertAnalysisProvenance(photos, [
        analysis({
          id: "p1",
          photo_url: "https://cdn/p1.jpg",
          photo_name: "a.jpg",
          source: "mock",
        }),
      ]);
      expect.fail("expected throw");
    } catch (e) {
      expect((e as { code?: string }).code).toBe(PHOTO_ANALYSIS_MOCK_FORBIDDEN);
    }

    expect(() =>
      assertAnalysisProvenance(photos, [
        analysis({ id: "p1", photo_url: "https://cdn/p1.jpg", photo_name: "a.jpg" }),
        analysis({ id: "extra", photo_url: "https://cdn/x.jpg", photo_name: "x.jpg" }),
      ]),
    ).toThrow(/Expected 1 analyses/);
  });

  it("J: production-valid set never accepts deterministic Kitchen/Bathroom/Living mock trio", () => {
    const mockTrio = ["Kitchen", "Bathroom", "Living Room"].map((room_type, i) =>
      analysis({
        id: `fallback-${i}`,
        source: "mock",
        room_type: room_type as RoomAnalysis["room_type"],
        photo_url: `/assets/demo-${i}.jpg`,
        photo_name: `demo-${i}.jpg`,
      }),
    );
    const oneRoomPhotos = [
      { id: "a", url: "https://cdn/a.jpg", name: "a.jpg" },
      { id: "b", url: "https://cdn/b.jpg", name: "b.jpg" },
      { id: "c", url: "https://cdn/c.jpg", name: "c.jpg" },
    ];
    expect(isProductionValidAnalysisSet(mockTrio, oneRoomPhotos)).toBe(false);
  });
});
