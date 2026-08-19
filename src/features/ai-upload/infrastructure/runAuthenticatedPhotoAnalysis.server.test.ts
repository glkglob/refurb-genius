import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));

const {
  checkRateLimit,
  resolveCanonicalAuthorizedPhotos,
  signAuthorizedPhotoBatch,
  runSecurePhotoAnalysis,
  runSecurePhotoAnalysisHuggingFace,
} = vi.hoisted(() => ({
  checkRateLimit: vi.fn((_key?: string) => ({
    allowed: true as boolean,
    retryAfter: undefined as number | undefined,
  })),
  resolveCanonicalAuthorizedPhotos: vi.fn(),
  signAuthorizedPhotoBatch: vi.fn(),
  runSecurePhotoAnalysis: vi.fn(),
  runSecurePhotoAnalysisHuggingFace: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (key: string) => checkRateLimit(key),
  rateLimitKeyForUser: (userId: string, action: string) => `${userId}:${action}`,
}));

vi.mock("./resolveAuthorizedPhotos.server", () => ({
  resolveCanonicalAuthorizedPhotos: (input: unknown) => resolveCanonicalAuthorizedPhotos(input),
  signAuthorizedPhotoBatch: (client: unknown, batch: unknown) =>
    signAuthorizedPhotoBatch(client, batch),
}));

vi.mock("./adapters/ai-vision.adapter.server", () => ({
  runSecurePhotoAnalysis: (input: unknown) => runSecurePhotoAnalysis(input),
}));

vi.mock("./adapters/hf-vision.adapter.server", () => ({
  runSecurePhotoAnalysisHuggingFace: (input: unknown) => runSecurePhotoAnalysisHuggingFace(input),
}));

import {
  chunkCanonicalPhotosForVision,
  MAX_ANALYSIS_PHOTOS,
  MAX_PHOTOS_PER_VISION_BATCH,
  runAuthenticatedPhotoAnalysis,
} from "./runAuthenticatedPhotoAnalysis.server";
import {
  PHOTO_ANALYSIS_CARDINALITY_MISMATCH,
  PHOTO_ANALYSIS_CATALOGUE_TOO_LARGE,
  PHOTO_ANALYSIS_DUPLICATE_PHOTO_IDS,
  PHOTO_ANALYSIS_NO_SOURCE_PHOTOS,
  PHOTO_ANALYSIS_PROVIDER_UNAVAILABLE,
  PHOTO_ANALYSIS_PROVENANCE_MISMATCH,
} from "../domain";
import type { CanonicalAuthorizedPhoto } from "./resolveAuthorizedPhotos.server";

const USER = "user-1";
const PROJECT = "11111111-1111-1111-1111-111111111111";

function uuid(n: number): string {
  return `22222222-2222-2222-2222-${String(n).padStart(12, "0")}`;
}

function canonical(n: number): CanonicalAuthorizedPhoto {
  return {
    id: uuid(n),
    url: `https://cdn.example/${n}.jpg`,
    name: `${n}.jpg`,
    size: 10,
    storagePath: `user-1/proj/${n}.jpg`,
  };
}

function analysisOf(photo: CanonicalAuthorizedPhoto) {
  return {
    id: `a-${photo.id}`,
    photo_id: photo.id,
    photo_url: photo.url,
    photo_name: photo.name,
    room_type: "Kitchen" as const,
    condition_level: "Average" as const,
    refurbishment_level: "Medium" as const,
    visible_issues: [],
    recommended_works: [],
    ai_summary: "ok",
    confidence_score: 0.8,
    source: "ai" as const,
  };
}

const supabase = { from: vi.fn(), storage: { from: vi.fn() } } as never;

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockReturnValue({ allowed: true, retryAfter: undefined });
  process.env.OPENAI_API_KEY = "test-key";
  delete process.env.AI_VISION_PROVIDER;

  signAuthorizedPhotoBatch.mockImplementation(
    async (_client: unknown, batch: CanonicalAuthorizedPhoto[]) =>
      batch.map((photo, index) => ({
        ...photo,
        retrievalUrl: `https://signed.example/${photo.id}?n=${index}&t=${Date.now()}`,
      })),
  );

  runSecurePhotoAnalysis.mockImplementation(
    async (payload: { photos: CanonicalAuthorizedPhoto[] }) =>
      payload.photos.map((photo) => analysisOf(photo)),
  );
});

describe("chunkCanonicalPhotosForVision", () => {
  it("does not import or alias upload MAX_PHOTOS_PER_BATCH", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(
        process.cwd(),
        "src/features/ai-upload/infrastructure/runAuthenticatedPhotoAnalysis.server.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/\bMAX_PHOTOS_PER_BATCH\b/);
    expect(src).not.toMatch(/MAX_PROJECT_PHOTOS/);
    expect(src).toMatch(/MAX_ANALYSIS_PHOTOS = 30/);
    expect(src).toMatch(/MAX_PHOTOS_PER_VISION_BATCH = 10/);
  });

  it("1 photo = [1]; 10 = [10]; 11 = [10,1]; 30 = [10,10,10]", () => {
    expect(MAX_PHOTOS_PER_VISION_BATCH).toBe(10);
    expect(MAX_ANALYSIS_PHOTOS).toBe(30);
    expect(chunkCanonicalPhotosForVision([1]).map((b) => b.length)).toEqual([1]);
    expect(chunkCanonicalPhotosForVision(Array.from({ length: 10 })).map((b) => b.length)).toEqual([
      10,
    ]);
    expect(chunkCanonicalPhotosForVision(Array.from({ length: 11 })).map((b) => b.length)).toEqual([
      10, 1,
    ]);
    expect(chunkCanonicalPhotosForVision(Array.from({ length: 30 })).map((b) => b.length)).toEqual([
      10, 10, 10,
    ]);
  });

  it("31 photos reject before any batch is formed", () => {
    expect(() => chunkCanonicalPhotosForVision(Array.from({ length: 31 }))).toThrow(
      expect.objectContaining({ code: PHOTO_ANALYSIS_CATALOGUE_TOO_LARGE }),
    );
  });
});

describe("runAuthenticatedPhotoAnalysis", () => {
  it("rejects zero photo IDs before rate-limit or resolve", async () => {
    await expect(
      runAuthenticatedPhotoAnalysis({
        userId: USER,
        supabase,
        projectId: PROJECT,
        photoIds: [],
        catalogueMode: "exact",
      }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_NO_SOURCE_PHOTOS });
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(resolveCanonicalAuthorizedPhotos).not.toHaveBeenCalled();
  });

  it("rejects duplicate IDs as 400 before catalogue/provider", async () => {
    await expect(
      runAuthenticatedPhotoAnalysis({
        userId: USER,
        supabase,
        projectId: PROJECT,
        photoIds: [uuid(1), uuid(1)],
        catalogueMode: "exact",
      }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_DUPLICATE_PHOTO_IDS });
    expect(resolveCanonicalAuthorizedPhotos).not.toHaveBeenCalled();
    expect(signAuthorizedPhotoBatch).not.toHaveBeenCalled();
    expect(runSecurePhotoAnalysis).not.toHaveBeenCalled();
  });

  it("charges one logical ai-vision rate-limit operation", async () => {
    const photos = [canonical(1), canonical(2)];
    resolveCanonicalAuthorizedPhotos.mockResolvedValue(photos);

    await runAuthenticatedPhotoAnalysis({
      userId: USER,
      supabase,
      projectId: PROJECT,
      photoIds: photos.map((p) => p.id),
      catalogueMode: "exact",
    });

    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(checkRateLimit).toHaveBeenCalledWith(`${USER}:ai-vision`);
  });

  it("does not rate-limit per JIT batch", async () => {
    const photos = Array.from({ length: 11 }, (_, i) => canonical(i + 1));
    resolveCanonicalAuthorizedPhotos.mockResolvedValue(photos);

    await runAuthenticatedPhotoAnalysis({
      userId: USER,
      supabase,
      projectId: PROJECT,
      photoIds: photos.map((p) => p.id),
      catalogueMode: "exact",
    });

    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(signAuthorizedPhotoBatch).toHaveBeenCalledTimes(2);
    expect(runSecurePhotoAnalysis).toHaveBeenCalledTimes(2);
  });

  it("signs immediately before each batch and does not reuse prior batch URLs", async () => {
    const photos = Array.from({ length: 11 }, (_, i) => canonical(i + 1));
    resolveCanonicalAuthorizedPhotos.mockResolvedValue(photos);

    const seenUrls: string[] = [];
    signAuthorizedPhotoBatch.mockImplementation(
      async (_client: unknown, batch: CanonicalAuthorizedPhoto[]) => {
        const signed = batch.map((photo) => ({
          ...photo,
          retrievalUrl: `https://signed.example/${photo.id}?once=${seenUrls.length}`,
        }));
        for (const row of signed) seenUrls.push(row.retrievalUrl);
        return signed;
      },
    );

    runSecurePhotoAnalysis.mockImplementation(
      async (payload: { photos: Array<{ retrievalUrl?: string }> }) => {
        const urls = payload.photos.map((p) => p.retrievalUrl);
        expect(urls.every((url) => typeof url === "string")).toBe(true);
        return payload.photos.map((photo) => analysisOf(photo as CanonicalAuthorizedPhoto));
      },
    );

    await runAuthenticatedPhotoAnalysis({
      userId: USER,
      supabase,
      projectId: PROJECT,
      photoIds: photos.map((p) => p.id),
      catalogueMode: "exact",
    });

    expect(signAuthorizedPhotoBatch.mock.invocationCallOrder[0]).toBeLessThan(
      runSecurePhotoAnalysis.mock.invocationCallOrder[0] ?? 0,
    );
    expect(seenUrls).toHaveLength(11);
    expect(new Set(seenUrls).size).toBe(11);
    const firstBatchUrls = new Set(seenUrls.slice(0, 10));
    const secondBatchUrls = seenUrls.slice(10);
    for (const url of secondBatchUrls) {
      expect(firstBatchUrls.has(url)).toBe(false);
    }
  });

  it("rejects 31 canonical photos before any sign or provider work", async () => {
    const photos = Array.from({ length: 31 }, (_, i) => canonical(i + 1));
    resolveCanonicalAuthorizedPhotos.mockResolvedValue(photos);

    await expect(
      runAuthenticatedPhotoAnalysis({
        userId: USER,
        supabase,
        projectId: PROJECT,
        photoIds: photos.map((p) => p.id),
        catalogueMode: "exact",
      }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_CATALOGUE_TOO_LARGE });
    expect(signAuthorizedPhotoBatch).not.toHaveBeenCalled();
    expect(runSecurePhotoAnalysis).not.toHaveBeenCalled();
  });

  it("stops later batches when batch N fails", async () => {
    const photos = Array.from({ length: 11 }, (_, i) => canonical(i + 1));
    resolveCanonicalAuthorizedPhotos.mockResolvedValue(photos);
    runSecurePhotoAnalysis
      .mockRejectedValueOnce(new Error("provider exploded"))
      .mockResolvedValue([]);

    await expect(
      runAuthenticatedPhotoAnalysis({
        userId: USER,
        supabase,
        projectId: PROJECT,
        photoIds: photos.map((p) => p.id),
        catalogueMode: "exact",
      }),
    ).rejects.toThrow(/provider exploded/);
    expect(runSecurePhotoAnalysis).toHaveBeenCalledTimes(1);
    expect(signAuthorizedPhotoBatch).toHaveBeenCalledTimes(1);
  });

  it("fails the whole operation on malformed batch cardinality", async () => {
    const photos = [canonical(1), canonical(2)];
    resolveCanonicalAuthorizedPhotos.mockResolvedValue(photos);
    runSecurePhotoAnalysis.mockResolvedValue([analysisOf(photos[0]!)]);

    await expect(
      runAuthenticatedPhotoAnalysis({
        userId: USER,
        supabase,
        projectId: PROJECT,
        photoIds: photos.map((p) => p.id),
        catalogueMode: "exact",
      }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_CARDINALITY_MISMATCH });
  });

  it("fails the whole operation when combined output is missing a photo", async () => {
    const photos = [canonical(1), canonical(2)];
    resolveCanonicalAuthorizedPhotos.mockResolvedValue(photos);
    runSecurePhotoAnalysis.mockResolvedValue([
      analysisOf(photos[0]!),
      { ...analysisOf(photos[0]!), id: "dup" },
    ]);

    await expect(
      runAuthenticatedPhotoAnalysis({
        userId: USER,
        supabase,
        projectId: PROJECT,
        photoIds: photos.map((p) => p.id),
        catalogueMode: "exact",
      }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(
        new RegExp(`${PHOTO_ANALYSIS_PROVENANCE_MISMATCH}|${PHOTO_ANALYSIS_CARDINALITY_MISMATCH}`),
      ),
    });
  });

  it("maps missing provider configuration to a safe unavailable error", async () => {
    const photos = [canonical(1)];
    resolveCanonicalAuthorizedPhotos.mockResolvedValue(photos);
    runSecurePhotoAnalysis.mockRejectedValue(new Error("OPENAI_API_KEY is not configured"));

    await expect(
      runAuthenticatedPhotoAnalysis({
        userId: USER,
        supabase,
        projectId: PROJECT,
        photoIds: photos.map((p) => p.id),
        catalogueMode: "exact",
      }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_PROVIDER_UNAVAILABLE });
  });

  it("returns durable photo_url and never a retrieval URL", async () => {
    const photos = [canonical(1)];
    resolveCanonicalAuthorizedPhotos.mockResolvedValue(photos);

    const result = await runAuthenticatedPhotoAnalysis({
      userId: USER,
      supabase,
      projectId: PROJECT,
      photoIds: photos.map((p) => p.id),
      catalogueMode: "exact",
    });

    expect(result[0]?.photo_url).toBe(photos[0]?.url);
    expect(JSON.stringify(result)).not.toMatch(/retrievalUrl|token=|Authorization|Bearer /);
    expect(runSecurePhotoAnalysisHuggingFace).not.toHaveBeenCalled();
  });
});
