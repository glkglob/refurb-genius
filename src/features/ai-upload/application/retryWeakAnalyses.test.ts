import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRetryWeakAnalyses } from "./retryWeakAnalyses";
import type { AnalysisPhotoSource, RoomAnalysis } from "../domain";
import type { AiVisionPort, PhotoCatalogPort, RoomAnalysisRepository } from "./ports";

function analysis(partial: Partial<RoomAnalysis> & Pick<RoomAnalysis, "id">): RoomAnalysis {
  return {
    photo_id: partial.id,
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

describe("makeRetryWeakAnalyses (P0 stale mock recovery)", () => {
  let vision: AiVisionPort;
  let analyses: RoomAnalysisRepository;
  let photos: PhotoCatalogPort;

  const realCatalog: AnalysisPhotoSource[] = [
    { id: "real-1", url: "https://cdn/real-1.jpg", name: "room-a.jpg" },
    { id: "real-2", url: "https://cdn/real-2.jpg", name: "room-b.jpg" },
    { id: "real-3", url: "https://cdn/real-3.jpg", name: "room-c.jpg" },
  ];

  beforeEach(() => {
    vision = {
      analyzePhotos: vi.fn(async ({ photos: list }: { photos: AnalysisPhotoSource[] }) =>
        list.map((p: AnalysisPhotoSource) =>
          analysis({
            id: p.id,
            photo_url: p.url,
            photo_name: p.name,
            source: "ai",
            room_type: "Other",
          }),
        ),
      ),
    };
    analyses = {
      get: vi.fn(),
      load: vi.fn(),
      save: vi.fn(async () => undefined),
      subscribe: vi.fn(() => () => undefined),
    };
    photos = {
      listPhotos: vi.fn(async () => realCatalog),
    };
  });

  it("F: stale mock set retries against current real catalogue, not mock URLs", async () => {
    const mockRows: RoomAnalysis[] = [
      analysis({
        id: "fallback-0",
        photo_id: null,
        photo_url: "/assets/before.jpg",
        photo_name: "fallback-living.jpg",
        source: "mock",
        room_type: "Kitchen",
      }),
      analysis({
        id: "fallback-1",
        photo_url: "/assets/after.jpg",
        photo_name: "fallback-kitchen.jpg",
        photo_id: null,
        source: "mock",
        room_type: "Bathroom",
      }),
      analysis({
        id: "fallback-2",
        photo_url: "/assets/hero-after.jpg",
        photo_name: "fallback-exterior.jpg",
        photo_id: null,
        source: "mock",
        room_type: "Living Room",
      }),
    ];
    analyses.load = vi.fn(async () => mockRows);

    const retry = makeRetryWeakAnalyses({ vision, analyses, photos });
    const result = await retry({ projectId: "proj-1" });

    expect(vision.analyzePhotos).toHaveBeenCalledWith({
      projectId: "proj-1",
      photos: realCatalog,
    });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.id)).toEqual(["real-1", "real-2", "real-3"]);
    expect(result.every((r) => r.source === "ai")).toBe(true);
    expect(analyses.save).toHaveBeenCalledWith("proj-1", result);
  });

  it("selective retry still matches genuine fallback rows by catalogue photo_id", async () => {
    const existing: RoomAnalysis[] = [
      analysis({
        id: "good",
        photo_id: "real-1",
        photo_url: "https://cdn/real-1.jpg",
        photo_name: "room-a.jpg",
        confidence_score: 0.9,
      }),
      analysis({
        id: "weak",
        photo_id: "real-2",
        photo_url: "https://cdn/real-2.jpg",
        photo_name: "room-b.jpg",
        source: "fallback",
        confidence_score: 0,
      }),
    ];
    analyses.load = vi.fn(async () => existing);

    const retry = makeRetryWeakAnalyses({ vision, analyses, photos });
    await retry({ projectId: "proj-1" });

    expect(vision.analyzePhotos).toHaveBeenCalledWith({
      projectId: "proj-1",
      photos: [realCatalog[1]],
    });
  });

  it("H: vision failure does not save (existing mock rows not destroyed)", async () => {
    analyses.load = vi.fn(async () => [
      analysis({ id: "m", source: "mock", room_type: "Kitchen", photo_url: "/assets/before.jpg" }),
    ]);
    vision.analyzePhotos = vi.fn(async () => {
      throw new Error("AI offline");
    });
    const retry = makeRetryWeakAnalyses({ vision, analyses, photos });
    await expect(retry({ projectId: "proj-1" })).rejects.toThrow("AI offline");
    expect(analyses.save).not.toHaveBeenCalled();
  });
});
