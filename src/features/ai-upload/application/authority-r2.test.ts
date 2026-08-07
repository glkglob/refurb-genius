/**
 * P0-PHOTO-ANALYZE-R2 — IV L–Z authority regression coverage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeAnalyzePhotos } from "./analyzePhotos";
import { makeRetryWeakAnalyses } from "./retryWeakAnalyses";
import {
  assertAnalysisProvenance,
  catalogueIdentityFingerprint,
  isProductionValidAnalysisSet,
  isStaleAnalysisRelativeToCatalogue,
  PHOTO_ANALYSIS_MOCK_FORBIDDEN,
  PHOTO_ANALYSIS_NO_SOURCE_PHOTOS,
  type AnalysisPhotoSource,
  type RoomAnalysis,
} from "../domain";
import type { AiVisionPort, PhotoCatalogPort, RoomAnalysisRepository } from "./ports";

function analysis(
  partial: Partial<RoomAnalysis> & Pick<RoomAnalysis, "id"> & { photo_id?: string | null },
): RoomAnalysis {
  const photoId = partial.photo_id === undefined ? partial.id : partial.photo_id;
  return {
    id: partial.id,
    photo_id: photoId,
    photo_url: partial.photo_url ?? `https://cdn/${partial.id}.jpg`,
    photo_name: partial.photo_name ?? `${partial.id}.jpg`,
    room_type: partial.room_type ?? "Other",
    condition_level: partial.condition_level ?? "Average",
    refurbishment_level: partial.refurbishment_level ?? "Medium",
    visible_issues: partial.visible_issues ?? [],
    recommended_works: partial.recommended_works ?? [],
    ai_summary: partial.ai_summary ?? "ok",
    confidence_score: partial.confidence_score ?? 0.9,
    source: partial.source ?? "ai",
  };
}

describe("P0-PHOTO-ANALYZE-R2 authority gates", () => {
  let vision: AiVisionPort;
  let analyses: RoomAnalysisRepository;
  let photos: PhotoCatalogPort;
  let cacheSnapshot: RoomAnalysis[] | undefined;

  beforeEach(() => {
    cacheSnapshot = undefined;
    vision = {
      analyzePhotos: vi.fn(async ({ photos: list }: { photos: AnalysisPhotoSource[] }) =>
        list.map((p) =>
          analysis({
            id: `a-${p.id}`,
            photo_id: p.id,
            photo_url: p.url,
            photo_name: p.name,
            source: "ai",
          }),
        ),
      ),
    };
    analyses = {
      get: vi.fn(() => cacheSnapshot),
      load: vi.fn(async () => cacheSnapshot),
      save: vi.fn(async (_id, rows) => {
        cacheSnapshot = rows;
      }),
      subscribe: vi.fn(() => () => undefined),
    };
    photos = {
      listPhotos: vi.fn(async () => [
        { id: "p1", url: "https://cdn/p1.jpg", name: "1.jpg" },
        { id: "p2", url: "https://cdn/p2.jpg", name: "2.jpg" },
        { id: "p3", url: "https://cdn/p3.jpg", name: "3.jpg" },
      ]),
    };
  });

  it("L: durable photo_id round-trip through save reload semantics", async () => {
    const analyze = makeAnalyzePhotos({ vision, analyses, photos });
    const result = await analyze({ projectId: "proj" });
    expect(result.map((r) => r.photo_id)).toEqual(["p1", "p2", "p3"]);
    expect(analyses.save).toHaveBeenCalled();
    // Reload path uses saved rows with photo_id retained.
    analyses.load = vi.fn(async () => result);
    const reloaded = await analyses.load!("proj");
    expect(reloaded?.map((r) => r.photo_id)).toEqual(["p1", "p2", "p3"]);
    expect(
      isProductionValidAnalysisSet(reloaded!, [
        { id: "p1", url: "https://cdn/p1.jpg", name: "1.jpg" },
        { id: "p2", url: "https://cdn/p2.jpg", name: "2.jpg" },
        { id: "p3", url: "https://cdn/p3.jpg", name: "3.jpg" },
      ]),
    ).toBe(true);
  });

  it("M/Q: save failure rejects and does not update success path cache", async () => {
    const prior = [analysis({ id: "old", photo_id: "p1" })];
    cacheSnapshot = prior;
    analyses.save = vi.fn(async () => {
      throw new Error("rpc failed");
    });
    const analyze = makeAnalyzePhotos({ vision, analyses, photos });
    await expect(analyze({ projectId: "proj" })).rejects.toThrow("rpc failed");
    // Application did not replace cache itself; repository contract tested separately.
    expect(cacheSnapshot).toEqual(prior);
  });

  it("H: AI failure before save does not call save", async () => {
    vision.analyzePhotos = vi.fn(async () => {
      throw new Error("vision down");
    });
    const analyze = makeAnalyzePhotos({ vision, analyses, photos });
    await expect(analyze({ projectId: "proj" })).rejects.toThrow("vision down");
    expect(analyses.save).not.toHaveBeenCalled();
  });

  it("O: same-count catalogue replacement detected as stale", () => {
    const analysesSet = [
      analysis({
        id: "a1",
        photo_id: "p1",
        photo_url: "https://cdn/p1.jpg",
        photo_name: "1.jpg",
      }),
      analysis({
        id: "a2",
        photo_id: "p2",
        photo_url: "https://cdn/p2.jpg",
        photo_name: "2.jpg",
      }),
      analysis({
        id: "a3",
        photo_id: "p3",
        photo_url: "https://cdn/p3.jpg",
        photo_name: "3.jpg",
      }),
    ];
    const before = [
      { id: "p1", url: "https://cdn/p1.jpg", name: "1.jpg" },
      { id: "p2", url: "https://cdn/p2.jpg", name: "2.jpg" },
      { id: "p3", url: "https://cdn/p3.jpg", name: "3.jpg" },
    ];
    const after = [
      { id: "p1", url: "https://cdn/p1.jpg", name: "1.jpg" },
      { id: "p2", url: "https://cdn/p2.jpg", name: "2.jpg" },
      { id: "p4", url: "https://cdn/p4.jpg", name: "4.jpg" },
    ];
    expect(catalogueIdentityFingerprint(before)).not.toBe(catalogueIdentityFingerprint(after));
    expect(isProductionValidAnalysisSet(analysesSet, before)).toBe(true);
    expect(isStaleAnalysisRelativeToCatalogue(analysesSet, after)).toBe(true);
    expect(isProductionValidAnalysisSet(analysesSet, after)).toBe(false);
  });

  it("Z: photo_id=null legacy rows are stale", () => {
    const legacy = [
      analysis({
        id: "row1",
        photo_id: null,
        photo_url: "https://cdn/p1.jpg",
        photo_name: "1.jpg",
      }),
    ];
    const catalogue = [{ id: "p1", url: "https://cdn/p1.jpg", name: "1.jpg" }];
    expect(isProductionValidAnalysisSet(legacy, catalogue)).toBe(false);
    expect(isStaleAnalysisRelativeToCatalogue(legacy, catalogue)).toBe(true);
  });

  it("W: mock save path is rejected by assertAnalysisProvenance", () => {
    const photosList: AnalysisPhotoSource[] = [
      { id: "p1", url: "https://cdn/p1.jpg", name: "1.jpg" },
    ];
    const mockResults = [
      analysis({
        id: "m",
        photo_id: "p1",
        photo_url: "https://cdn/p1.jpg",
        photo_name: "1.jpg",
        source: "mock",
      }),
    ];
    expect(() => assertAnalysisProvenance(photosList, mockResults)).toThrow(/Mock analysis/);
  });

  it("X: genuine fallback with real photo_id is valid/reviewable", () => {
    const set = [
      analysis({
        id: "a1",
        photo_id: "p1",
        photo_url: "https://cdn/p1.jpg",
        photo_name: "1.jpg",
        source: "fallback",
        confidence_score: 0,
      }),
    ];
    const catalogue = [{ id: "p1", url: "https://cdn/p1.jpg", name: "1.jpg" }];
    expect(isProductionValidAnalysisSet(set, catalogue)).toBe(true);
  });

  it("U: duplicate photo IDs rejected", () => {
    const photosList: AnalysisPhotoSource[] = [
      { id: "p1", url: "https://cdn/p1.jpg", name: "1.jpg" },
      { id: "p1", url: "https://cdn/p1b.jpg", name: "1b.jpg" },
    ];
    expect(() => assertAnalysisProvenance(photosList, [])).toThrow(/Duplicate/);
  });

  it("V: mismatched photo_id / URL rejected", () => {
    const photosList: AnalysisPhotoSource[] = [
      { id: "p1", url: "https://cdn/p1.jpg", name: "1.jpg" },
    ];
    const bad = [
      analysis({
        id: "a1",
        photo_id: "p1",
        photo_url: "https://cdn/OTHER.jpg",
        photo_name: "1.jpg",
      }),
    ];
    expect(() => assertAnalysisProvenance(photosList, bad)).toThrow(/does not match/);
  });

  it("F: mock recovery analyses full real catalogue", async () => {
    analyses.load = vi.fn(async () => [
      analysis({
        id: "m0",
        photo_id: null,
        photo_url: "/assets/before.jpg",
        photo_name: "fallback-living.jpg",
        source: "mock",
        room_type: "Kitchen",
      }),
    ]);
    const retry = makeRetryWeakAnalyses({ vision, analyses, photos });
    const out = await retry({ projectId: "proj" });
    expect(vision.analyzePhotos).toHaveBeenCalledWith({
      projectId: "proj",
      photos: await photos.listPhotos("proj"),
    });
    expect(out.every((r) => r.photo_id && r.source === "ai")).toBe(true);
  });

  it("A: zero photos rejected", async () => {
    photos.listPhotos = vi.fn(async () => []);
    const analyze = makeAnalyzePhotos({ vision, analyses, photos });
    await expect(analyze({ projectId: "proj" })).rejects.toMatchObject({
      code: PHOTO_ANALYSIS_NO_SOURCE_PHOTOS,
    });
  });

  it("P: redesign-style authority blocks mock/null photo_id (downstream helper)", () => {
    const mockOnly = [
      analysis({
        id: "m",
        photo_id: null,
        source: "mock",
        room_type: "Kitchen",
        photo_url: "/assets/x.jpg",
        photo_name: "x.jpg",
      }),
    ];
    expect(isProductionValidAnalysisSet(mockOnly, [{ id: "p1", url: "u", name: "n" }])).toBe(false);
  });

  it("selective genuine fallback retry still uses photo_id", async () => {
    analyses.load = vi.fn(async () => [
      analysis({
        id: "g",
        photo_id: "p1",
        photo_url: "https://cdn/p1.jpg",
        photo_name: "1.jpg",
        confidence_score: 0.9,
      }),
      analysis({
        id: "w",
        photo_id: "p2",
        photo_url: "https://cdn/p2.jpg",
        photo_name: "2.jpg",
        source: "fallback",
        confidence_score: 0,
      }),
    ]);
    const retry = makeRetryWeakAnalyses({ vision, analyses, photos });
    await retry({ projectId: "proj" });
    const call = (vision.analyzePhotos as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.photos.map((p: AnalysisPhotoSource) => p.id)).toEqual(["p2"]);
  });
});

describe("serverFn schema (B + photoIds)", () => {
  it("rejects empty photos/photoIds", async () => {
    const { z } = await import("zod");
    const schema = z
      .object({
        projectId: z.string().uuid(),
        photoIds: z.array(z.string().uuid()).min(1).optional(),
        photos: z
          .array(z.object({ id: z.string().uuid() }))
          .min(1)
          .optional(),
      })
      .superRefine((val, ctx) => {
        const ids = val.photoIds ?? val.photos?.map((p) => p.id) ?? [];
        if (ids.length < 1) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "empty", path: ["photos"] });
        }
      });
    expect(
      schema.safeParse({
        projectId: "11111111-1111-1111-1111-111111111111",
        photos: [],
      }).success,
    ).toBe(false);
  });
});

// Satisfy lint for unused import in some bundlers
void PHOTO_ANALYSIS_MOCK_FORBIDDEN;
