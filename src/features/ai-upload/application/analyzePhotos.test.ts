import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeAnalyzePhotos } from "./analyzePhotos";
import type { AnalysisPhotoSource, RoomAnalysis } from "../domain";
import type { AiVisionPort, PhotoCatalogPort, RoomAnalysisRepository } from "./ports";

function makeAnalysis(id: string): RoomAnalysis {
  return {
    id,
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
  };
}

describe("makeAnalyzePhotos (C5-2 async catalog)", () => {
  let vision: AiVisionPort;
  let analyses: RoomAnalysisRepository;
  let photos: PhotoCatalogPort;

  beforeEach(() => {
    vision = {
      analyzePhotos: vi.fn(async ({ photos: list }: { photos: AnalysisPhotoSource[] }) =>
        list.map((p) => makeAnalysis(p.id)),
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

  it("uses empty list when catalog port is omitted", async () => {
    const analyze = makeAnalyzePhotos({ vision, analyses });
    await analyze({ projectId: "proj-1" });

    expect(vision.analyzePhotos).toHaveBeenCalledWith({
      projectId: "proj-1",
      photos: [],
    });
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
});
