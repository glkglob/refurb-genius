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
});
