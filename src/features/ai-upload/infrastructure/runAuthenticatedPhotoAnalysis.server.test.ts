vi.mock("@tanstack/react-start/server-only", () => ({}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PHOTO_ANALYSIS_NO_SOURCE_PHOTOS, PhotoAnalysisError, type RoomAnalysis } from "../domain";

const listAuthorizedProjectPhotosWithClient = vi.fn();
const listProjectRoomAnalysesWithClient = vi.fn();
const replaceProjectRoomAnalysesWithClient = vi.fn();
const runSecurePhotoAnalysis = vi.fn();
const runSecurePhotoAnalysisHuggingFace = vi.fn();
const checkRateLimit = vi.fn();

vi.mock("./resolveAuthorizedPhotos.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./resolveAuthorizedPhotos.server")>();
  return {
    ...actual,
    listAuthorizedProjectPhotosWithClient: (...args: unknown[]) =>
      listAuthorizedProjectPhotosWithClient(...args),
  };
});

vi.mock("./repositories/room-analysis.repository.server", () => ({
  listProjectRoomAnalysesWithClient: (...args: unknown[]) =>
    listProjectRoomAnalysesWithClient(...args),
  replaceProjectRoomAnalysesWithClient: (...args: unknown[]) =>
    replaceProjectRoomAnalysesWithClient(...args),
}));

vi.mock("./adapters/ai-vision.adapter.server", () => ({
  runSecurePhotoAnalysis: (...args: unknown[]) => runSecurePhotoAnalysis(...args),
}));

vi.mock("./adapters/hf-vision.adapter.server", () => ({
  runSecurePhotoAnalysisHuggingFace: (...args: unknown[]) =>
    runSecurePhotoAnalysisHuggingFace(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitKeyForUser: (userId: string, bucket: string) => `${userId}:${bucket}`,
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}));

const { runAuthenticatedPhotoAnalysis } = await import("./runAuthenticatedPhotoAnalysis.server");

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PHOTO = "11111111-aaaa-4aaa-8aaa-111111111111";
const PHOTO_B = "22222222-aaaa-4aaa-8aaa-222222222222";

function photo(id: string) {
  return {
    id,
    url: `https://cdn/${id}.jpg`,
    name: `${id}.jpg`,
    storagePath: `${id}.jpg`,
    retrievalUrl: `https://signed/${id}.jpg`,
  };
}

function analysis(id: string, extra: Partial<RoomAnalysis> = {}): RoomAnalysis {
  return {
    id: `row-${id}`,
    photo_id: id,
    photo_url: `https://cdn/${id}.jpg`,
    photo_name: `${id}.jpg`,
    room_type: "Kitchen",
    condition_level: "Average",
    refurbishment_level: "Medium",
    visible_issues: [],
    recommended_works: [],
    ai_summary: "ok",
    confidence_score: 0.9,
    source: "ai",
    ...extra,
  };
}

const supabase = { from: vi.fn(), rpc: vi.fn(), storage: { from: vi.fn() } };

describe("runAuthenticatedPhotoAnalysis", () => {
  beforeEach(() => {
    listAuthorizedProjectPhotosWithClient.mockReset();
    listProjectRoomAnalysesWithClient.mockReset();
    replaceProjectRoomAnalysesWithClient.mockReset();
    runSecurePhotoAnalysis.mockReset();
    runSecurePhotoAnalysisHuggingFace.mockReset();
    checkRateLimit.mockReset();
    checkRateLimit.mockReturnValue({ allowed: true });
    replaceProjectRoomAnalysesWithClient.mockImplementation(
      async (_client: unknown, _projectId: string, rows: RoomAnalysis[]) => rows,
    );
  });

  it("zero canonical photos does not call vision or persist", async () => {
    listAuthorizedProjectPhotosWithClient.mockResolvedValue([]);
    await expect(
      runAuthenticatedPhotoAnalysis({
        userId: "user-1",
        supabase,
        projectId: PROJECT,
      }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_NO_SOURCE_PHOTOS });
    expect(runSecurePhotoAnalysis).not.toHaveBeenCalled();
    expect(replaceProjectRoomAnalysesWithClient).not.toHaveBeenCalled();
  });

  it("valid owned project sends authorised photos to vision then persists", async () => {
    const authorized = [photo(PHOTO)];
    listAuthorizedProjectPhotosWithClient.mockResolvedValue(authorized);
    const rows = [analysis(PHOTO)];
    runSecurePhotoAnalysis.mockResolvedValue(rows);

    const out = await runAuthenticatedPhotoAnalysis({
      userId: "user-1",
      supabase,
      projectId: PROJECT,
    });

    expect(runSecurePhotoAnalysis).toHaveBeenCalledWith({
      projectId: PROJECT,
      photos: authorized,
    });
    expect(replaceProjectRoomAnalysesWithClient).toHaveBeenCalledWith(supabase, PROJECT, rows);
    expect(out).toEqual(rows);
  });

  it("mock production output is rejected before persistence", async () => {
    listAuthorizedProjectPhotosWithClient.mockResolvedValue([photo(PHOTO)]);
    runSecurePhotoAnalysis.mockResolvedValue([analysis(PHOTO, { source: "mock" })]);

    await expect(
      runAuthenticatedPhotoAnalysis({
        userId: "user-1",
        supabase,
        projectId: PROJECT,
      }),
    ).rejects.toBeInstanceOf(PhotoAnalysisError);
    expect(replaceProjectRoomAnalysesWithClient).not.toHaveBeenCalled();
  });

  it("provenance mismatch is rejected before persistence", async () => {
    listAuthorizedProjectPhotosWithClient.mockResolvedValue([photo(PHOTO)]);
    runSecurePhotoAnalysis.mockResolvedValue([analysis(PHOTO_B)]);

    await expect(
      runAuthenticatedPhotoAnalysis({
        userId: "user-1",
        supabase,
        projectId: PROJECT,
      }),
    ).rejects.toBeInstanceOf(PhotoAnalysisError);
    expect(replaceProjectRoomAnalysesWithClient).not.toHaveBeenCalled();
  });

  it("provider failure does not persist", async () => {
    listAuthorizedProjectPhotosWithClient.mockResolvedValue([photo(PHOTO)]);
    runSecurePhotoAnalysis.mockRejectedValue(new Error("vision down"));

    await expect(
      runAuthenticatedPhotoAnalysis({
        userId: "user-1",
        supabase,
        projectId: PROJECT,
      }),
    ).rejects.toThrow(/vision down/);
    expect(replaceProjectRoomAnalysesWithClient).not.toHaveBeenCalled();
  });

  it("retry-weak re-analyses only weak rows and persists the merge", async () => {
    const authorized = [photo(PHOTO), photo(PHOTO_B)];
    listAuthorizedProjectPhotosWithClient.mockResolvedValue(authorized);
    listProjectRoomAnalysesWithClient.mockResolvedValue([
      analysis(PHOTO, { confidence_score: 0.2, source: "fallback" }),
      analysis(PHOTO_B, { confidence_score: 0.95, source: "ai" }),
    ]);
    runSecurePhotoAnalysis.mockResolvedValue([analysis(PHOTO, { ai_summary: "retried" })]);

    const out = await runAuthenticatedPhotoAnalysis({
      userId: "user-1",
      supabase,
      projectId: PROJECT,
      mode: "retry-weak",
    });

    expect(runSecurePhotoAnalysis).toHaveBeenCalledWith({
      projectId: PROJECT,
      photos: [authorized[0]],
    });
    expect(replaceProjectRoomAnalysesWithClient).toHaveBeenCalledTimes(1);
    expect(out.find((row) => row.photo_id === PHOTO)?.ai_summary).toBe("retried");
    expect(out.find((row) => row.photo_id === PHOTO_B)?.confidence_score).toBe(0.95);
  });
});
