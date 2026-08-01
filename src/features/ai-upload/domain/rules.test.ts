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
});
