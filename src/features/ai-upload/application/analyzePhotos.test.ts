import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeAnalyzePhotos } from "./analyzePhotos";
import {
  PHOTO_ANALYSIS_NO_SOURCE_PHOTOS,
  isSuccessfulProductionAnalysisSet,
  type AnalysisPhotoSource,
  type RoomAnalysis,
} from "../domain";
import type { AiVisionPort, PhotoCatalogPort, RoomAnalysisRepository } from "./ports";

function makeAnalysis(id: string, partial: Partial<RoomAnalysis> = {}): RoomAnalysis {
  return {
    id,
    photo_id: id,
    photo_url: `https://u/${id}`,
    photo_name: `${id}.jpg`,
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

describe("makeAnalyzePhotos (C5-2 async catalog + P0 real-photo authority)", () => {
  let vision: AiVisionPort;
  let analyses: RoomAnalysisRepository;
  let photos: PhotoCatalogPort;

  beforeEach(() => {
    vision = {
      analyzePhotos: vi.fn(async ({ photos: list }: { photos: AnalysisPhotoSource[] }) =>
        list.map((p) =>
          makeAnalysis(p.id, {
            photo_id: p.id,
            photo_url: p.url,
            photo_name: p.name,
            source: "ai",
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
      listPhotos: vi.fn(
        async () =>
          [
            { id: "c1", url: "https://u/c1", name: "c1.jpg", size: 10 },
          ] satisfies AnalysisPhotoSource[],
      ),
    };
  });

  it("awaits async listPhotos and passes resolved catalog to vision", async () => {
    const analyze = makeAnalyzePhotos({ vision, analyses, photos });
    const result = await analyze({ projectId: "proj-1" });

    expect(photos.listPhotos).toHaveBeenCalledWith("proj-1");
    expect(vision.analyzePhotos).toHaveBeenCalledWith({
      projectId: "proj-1",
      photos: [{ id: "c1", url: "https://u/c1", name: "c1.jpg", size: 10 }],
    });
    expect(analyses.save).toHaveBeenCalledWith("proj-1", result);
    expect(result.map((r) => r.id)).toEqual(["c1"]);
  });

  it("explicit photos bypass the catalog", async () => {
    const explicit: AnalysisPhotoSource[] = [{ id: "x1", url: "https://u/x1", name: "x1.jpg" }];
    const analyze = makeAnalyzePhotos({ vision, analyses, photos });
    await analyze({ projectId: "proj-1", photos: explicit });

    expect(photos.listPhotos).not.toHaveBeenCalled();
    expect(vision.analyzePhotos).toHaveBeenCalledWith({
      projectId: "proj-1",
      photos: explicit,
    });
  });

  it("A: zero catalogue photos — no vision, no mock, no persistence", async () => {
    photos.listPhotos = vi.fn(async () => []);
    const analyze = makeAnalyzePhotos({ vision, analyses, photos });

    await expect(analyze({ projectId: "proj-1" })).rejects.toMatchObject({
      code: PHOTO_ANALYSIS_NO_SOURCE_PHOTOS,
    });
    expect(vision.analyzePhotos).not.toHaveBeenCalled();
    expect(analyses.save).not.toHaveBeenCalled();
  });

  it("rejects empty explicit photos without calling vision", async () => {
    const analyze = makeAnalyzePhotos({ vision, analyses, photos });
    await expect(analyze({ projectId: "proj-1", photos: [] })).rejects.toMatchObject({
      code: PHOTO_ANALYSIS_NO_SOURCE_PHOTOS,
    });
    expect(vision.analyzePhotos).not.toHaveBeenCalled();
    expect(analyses.save).not.toHaveBeenCalled();
  });

  it("uses empty catalog port omission as no-photos failure", async () => {
    const analyze = makeAnalyzePhotos({ vision, analyses });
    await expect(analyze({ projectId: "proj-1" })).rejects.toMatchObject({
      code: PHOTO_ANALYSIS_NO_SOURCE_PHOTOS,
    });
    expect(vision.analyzePhotos).not.toHaveBeenCalled();
  });

  it("D: 3 real project photos — exactly those 3 sources passed to vision", async () => {
    const three: AnalysisPhotoSource[] = [
      { id: "p1", url: "https://cdn/p1.jpg", name: "a.jpg" },
      { id: "p2", url: "https://cdn/p2.jpg", name: "b.jpg" },
      { id: "p3", url: "https://cdn/p3.jpg", name: "c.jpg" },
    ];
    photos.listPhotos = vi.fn(async () => three);
    const analyze = makeAnalyzePhotos({ vision, analyses, photos });
    const result = await analyze({ projectId: "proj-1" });

    expect(vision.analyzePhotos).toHaveBeenCalledWith({
      projectId: "proj-1",
      photos: three,
    });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.id)).toEqual(["p1", "p2", "p3"]);
    expect(result.every((r) => r.source === "ai")).toBe(true);
  });

  it("G: successful replacement provenance matches project photos", async () => {
    const three: AnalysisPhotoSource[] = [
      { id: "p1", url: "https://cdn/p1.jpg", name: "a.jpg" },
      { id: "p2", url: "https://cdn/p2.jpg", name: "b.jpg" },
    ];
    const analyze = makeAnalyzePhotos({ vision, analyses, photos });
    const result = await analyze({ projectId: "proj-1", photos: three });
    expect(result[0]).toMatchObject({
      id: "p1",
      photo_url: "https://cdn/p1.jpg",
      photo_name: "a.jpg",
    });
    expect(result[1]).toMatchObject({
      id: "p2",
      photo_url: "https://cdn/p2.jpg",
      photo_name: "b.jpg",
    });
  });

  it("I: rejects mock vision results before persistence", async () => {
    vision.analyzePhotos = vi.fn(async ({ photos: list }: { photos: AnalysisPhotoSource[] }) =>
      list.map((p: AnalysisPhotoSource) =>
        makeAnalysis(p.id, {
          photo_url: p.url,
          photo_name: p.name,
          photo_id: null,
          source: "mock",
          room_type: "Kitchen",
        }),
      ),
    );
    const analyze = makeAnalyzePhotos({ vision, analyses, photos });
    await expect(
      analyze({
        projectId: "proj-1",
        photos: [{ id: "p1", url: "https://cdn/p1.jpg", name: "a.jpg" }],
      }),
    ).rejects.toThrow(/Mock analysis/);
    expect(analyses.save).not.toHaveBeenCalled();
  });

  it("rejects unexplained extra results", async () => {
    vision.analyzePhotos = vi.fn(async ({ photos: list }: { photos: AnalysisPhotoSource[] }) => [
      ...list.map((p: AnalysisPhotoSource) =>
        makeAnalysis(p.id, { photo_id: p.id, photo_url: p.url, photo_name: p.name }),
      ),
      makeAnalysis("extra", { photo_url: "https://u/extra", photo_name: "extra.jpg" }),
    ]);
    const analyze = makeAnalyzePhotos({ vision, analyses, photos });
    await expect(
      analyze({
        projectId: "proj-1",
        photos: [{ id: "p1", url: "https://cdn/p1.jpg", name: "a.jpg" }],
      }),
    ).rejects.toThrow(/Expected 1 analyses/);
    expect(analyses.save).not.toHaveBeenCalled();
  });

  it("propagates catalog errors without swallowing", async () => {
    photos.listPhotos = vi.fn(async () => {
      throw new Error("catalog failed");
    });
    const analyze = makeAnalyzePhotos({ vision, analyses, photos });

    await expect(analyze({ projectId: "proj-1" })).rejects.toThrow("catalog failed");
    expect(vision.analyzePhotos).not.toHaveBeenCalled();
    expect(analyses.save).not.toHaveBeenCalled();
  });

  it("H: AI failure during analysis does not call save (no destructive replacement)", async () => {
    vision.analyzePhotos = vi.fn(async () => {
      throw new Error("vision down");
    });
    const analyze = makeAnalyzePhotos({ vision, analyses, photos });
    await expect(analyze({ projectId: "proj-1" })).rejects.toThrow("vision down");
    expect(analyses.save).not.toHaveBeenCalled();
  });

  it("all-fallback grounded batch may persist as evidence but is not successful completion", async () => {
    const photosList: AnalysisPhotoSource[] = [
      { id: "p1", url: "https://cdn/p1.jpg", name: "a.jpg" },
      { id: "p2", url: "https://cdn/p2.jpg", name: "b.jpg" },
    ];
    vision.analyzePhotos = vi.fn(async ({ photos: list }: { photos: AnalysisPhotoSource[] }) =>
      list.map((p: AnalysisPhotoSource) =>
        makeAnalysis(p.id, {
          photo_id: p.id,
          photo_url: p.url,
          photo_name: p.name,
          source: "fallback",
          confidence_score: 0,
          ai_summary: "AI analysis could not be completed for this photo.",
        }),
      ),
    );
    const analyze = makeAnalyzePhotos({ vision, analyses, photos });
    const result = await analyze({ projectId: "proj-1", photos: photosList });
    expect(analyses.save).toHaveBeenCalledWith("proj-1", result);
    expect(isSuccessfulProductionAnalysisSet(result, photosList)).toBe(false);
  });
});
