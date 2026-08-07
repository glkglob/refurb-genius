/**
 * Incident reproduction (P0-PHOTO-ANALYZE §17):
 *
 * 1. project exists;
 * 2. user visits analysis before photos exist → no analysis created;
 * 3. user uploads 3 photos;
 * 4. user enters/runs analysis;
 * 5. exactly the 3 uploaded photos are sent to vision;
 * 6. no bundled demo photo is used;
 * 7. results are linked to those project photos.
 */
import { describe, it, expect, vi } from "vitest";
import { makeAnalyzePhotos } from "./analyzePhotos";
import { makeRetryWeakAnalyses } from "./retryWeakAnalyses";
import {
  isProductionValidAnalysisSet,
  isStaleAnalysisRelativeToCatalogue,
  PHOTO_ANALYSIS_NO_SOURCE_PHOTOS,
  type AnalysisPhotoSource,
  type RoomAnalysis,
} from "../domain";
import type { AiVisionPort, PhotoCatalogPort, RoomAnalysisRepository } from "./ports";

function aiResult(p: AnalysisPhotoSource): RoomAnalysis {
  return {
    id: p.id,
    photo_id: p.id,
    photo_url: p.url,
    photo_name: p.name,
    room_type: "Other",
    condition_level: "Average",
    refurbishment_level: "Medium",
    visible_issues: ["wear"],
    recommended_works: ["refresh"],
    ai_summary: "Grounded in supplied photo.",
    confidence_score: 0.8,
    source: "ai",
  };
}

describe("P0 incident reproduction — real photo authority", () => {
  it("sequence: empty → no analysis; upload 3 → analyse only those 3", async () => {
    let catalogue: AnalysisPhotoSource[] = [];

    const visionCalls: AnalysisPhotoSource[][] = [];
    const vision: AiVisionPort = {
      analyzePhotos: vi.fn(async ({ photos }) => {
        visionCalls.push(photos);
        return photos.map(aiResult);
      }),
    };
    const saved: RoomAnalysis[][] = [];
    const analyses: RoomAnalysisRepository = {
      get: vi.fn(() => saved.at(-1)),
      load: vi.fn(async () => saved.at(-1)),
      save: vi.fn(async (_id, rows) => {
        saved.push(rows);
      }),
      subscribe: vi.fn(() => () => undefined),
    };
    const photos: PhotoCatalogPort = {
      listPhotos: vi.fn(async () => catalogue),
    };

    const analyze = makeAnalyzePhotos({ vision, analyses, photos });

    // Steps 1–3: visit analysis before photos exist → no analysis created.
    await expect(analyze({ projectId: "incident-proj" })).rejects.toMatchObject({
      code: PHOTO_ANALYSIS_NO_SOURCE_PHOTOS,
    });
    expect(vision.analyzePhotos).not.toHaveBeenCalled();
    expect(saved).toHaveLength(0);

    // Step 4: upload 3 real project photos of one room.
    catalogue = [
      { id: "photo-a", url: "https://storage/proj/a.jpg", name: "IMG_001.jpg" },
      { id: "photo-b", url: "https://storage/proj/b.jpg", name: "IMG_002.jpg" },
      { id: "photo-c", url: "https://storage/proj/c.jpg", name: "IMG_003.jpg" },
    ];

    // Steps 5–8: run analysis — only those photos reach vision; results linked.
    const results = await analyze({ projectId: "incident-proj" });

    expect(visionCalls).toHaveLength(1);
    expect(visionCalls[0]).toEqual(catalogue);
    expect(
      visionCalls[0]?.some((p) => p.url.includes("/assets/") || p.id.startsWith("fallback-")),
    ).toBe(false);
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.id)).toEqual(["photo-a", "photo-b", "photo-c"]);
    expect(results.every((r) => r.source === "ai")).toBe(true);
    expect(isProductionValidAnalysisSet(results, catalogue)).toBe(true);
    expect(saved).toHaveLength(1);
  });

  it("historical mock Kitchen/Bathroom/Living Room cannot satisfy validity after real uploads", () => {
    const mockPersisted: RoomAnalysis[] = [
      {
        id: "fallback-0",
        photo_id: null,
        photo_url: "/assets/before.jpg",
        photo_name: "fallback-living.jpg",
        room_type: "Kitchen",
        condition_level: "Poor",
        refurbishment_level: "Heavy",
        visible_issues: [],
        recommended_works: [],
        ai_summary: "demo kitchen",
        confidence_score: 0.92,
        source: "mock",
      },
      {
        id: "fallback-1",
        photo_url: "/assets/after.jpg",
        photo_name: "fallback-kitchen.jpg",
        room_type: "Bathroom",
        condition_level: "Dated",
        refurbishment_level: "Medium",
        visible_issues: [],
        recommended_works: [],
        ai_summary: "demo bath",
        confidence_score: 0.87,
        photo_id: null,
        source: "mock",
      },
      {
        id: "fallback-2",
        photo_url: "/assets/hero-after.jpg",
        photo_name: "fallback-exterior.jpg",
        room_type: "Living Room",
        condition_level: "Average",
        refurbishment_level: "Light",
        visible_issues: [],
        recommended_works: [],
        ai_summary: "demo living",
        confidence_score: 0.81,
        photo_id: null,
        source: "mock",
      },
    ];
    const realPhotos = [
      { id: "photo-a", url: "https://storage/proj/a.jpg", name: "IMG_001.jpg" },
      { id: "photo-b", url: "https://storage/proj/b.jpg", name: "IMG_002.jpg" },
      { id: "photo-c", url: "https://storage/proj/c.jpg", name: "IMG_003.jpg" },
    ];

    expect(isStaleAnalysisRelativeToCatalogue(mockPersisted, realPhotos)).toBe(true);
    expect(isProductionValidAnalysisSet(mockPersisted, realPhotos)).toBe(false);
  });

  it("retry of mock set analyses the real catalogue only", async () => {
    const realCatalog: AnalysisPhotoSource[] = [
      { id: "photo-a", url: "https://storage/proj/a.jpg", name: "IMG_001.jpg" },
      { id: "photo-b", url: "https://storage/proj/b.jpg", name: "IMG_002.jpg" },
      { id: "photo-c", url: "https://storage/proj/c.jpg", name: "IMG_003.jpg" },
    ];
    const mockRows: RoomAnalysis[] = [
      {
        id: "fallback-0",
        photo_id: null,
        photo_url: "/assets/before.jpg",
        photo_name: "fallback-living.jpg",
        room_type: "Kitchen",
        condition_level: "Poor",
        refurbishment_level: "Heavy",
        visible_issues: [],
        recommended_works: [],
        ai_summary: "demo",
        confidence_score: 0.9,
        source: "mock",
      },
    ];

    const vision: AiVisionPort = {
      analyzePhotos: vi.fn(async ({ photos }) => photos.map(aiResult)),
    };
    const analyses: RoomAnalysisRepository = {
      get: vi.fn(),
      load: vi.fn(async () => mockRows),
      save: vi.fn(async () => undefined),
      subscribe: vi.fn(() => () => undefined),
    };
    const photos: PhotoCatalogPort = {
      listPhotos: vi.fn(async () => realCatalog),
    };

    const retry = makeRetryWeakAnalyses({ vision, analyses, photos });
    const out = await retry({ projectId: "incident-proj" });

    expect(vision.analyzePhotos).toHaveBeenCalledWith({
      projectId: "incident-proj",
      photos: realCatalog,
    });
    expect(out.map((r) => r.id)).toEqual(["photo-a", "photo-b", "photo-c"]);
  });
});
