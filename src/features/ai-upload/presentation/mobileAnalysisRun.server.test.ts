import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireMobileBearer, runAuthenticatedPhotoAnalysis } = vi.hoisted(() => ({
  requireMobileBearer: vi.fn(),
  runAuthenticatedPhotoAnalysis: vi.fn(),
}));

vi.mock("@/platform/http/mobile-bearer.server", () => ({
  requireMobileBearer: (...args: unknown[]) => requireMobileBearer(...args),
}));

vi.mock("../infrastructure/runAuthenticatedPhotoAnalysis.server", () => ({
  runAuthenticatedPhotoAnalysis: (...args: unknown[]) => runAuthenticatedPhotoAnalysis(...args),
}));

import {
  catalogueTooLargeError,
  PhotoAnalysisError,
  PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED,
  PHOTO_ANALYSIS_SOURCE_SET_MISMATCH,
  providerUnavailableError,
  retrievalUnavailableError,
} from "../domain";

const { handleMobileAnalysisRun } = await import("./mobileAnalysisRun.server");

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PHOTO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

function analysis() {
  return {
    id: "a1",
    photo_id: PHOTO,
    photo_url: "https://cdn.example/p.jpg",
    photo_name: "p.jpg",
    room_type: "Kitchen",
    condition_level: "Average",
    refurbishment_level: "Medium",
    visible_issues: [],
    recommended_works: [],
    ai_summary: "ok",
    confidence_score: 0.8,
    source: "ai",
  };
}

function request(body: unknown, headers?: HeadersInit): Request {
  return new Request("https://www.refurbgenius.info/api/mobile/v1/analysis/run", {
    method: "POST",
    headers: {
      authorization: "Bearer synthetic",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireMobileBearer.mockReset();
  runAuthenticatedPhotoAnalysis.mockReset();
  requireMobileBearer.mockResolvedValue({
    ok: true,
    userId: "user-1",
    user: { id: "user-1" },
    supabase: { marker: "bearer-client" },
    token: "synthetic",
  });
});

describe("handleMobileAnalysisRun", () => {
  it("returns 401 and performs zero privileged work when unauthenticated", async () => {
    requireMobileBearer.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const res = await handleMobileAnalysisRun(request({ projectId: PROJECT, photoIds: [PHOTO] }));
    expect(res.status).toBe(401);
    expect(runAuthenticatedPhotoAnalysis).not.toHaveBeenCalled();
  });

  it("rejects identity/URL/path/provider injection as Invalid request", async () => {
    const injections = [
      { projectId: PROJECT, photoIds: [PHOTO], userId: "attacker" },
      { projectId: PROJECT, photoIds: [PHOTO], url: "https://evil.example" },
      { projectId: PROJECT, photoIds: [PHOTO], retrievalUrl: "https://signed" },
      { projectId: PROJECT, photoIds: [PHOTO], storage_path: "x" },
      { projectId: PROJECT, photoIds: [PHOTO], analyses: [] },
      { projectId: PROJECT, photoIds: [PHOTO], photos: [] },
      { projectId: PROJECT, photoIds: [PHOTO], provider: "openai" },
    ];

    for (const body of injections) {
      const res = await handleMobileAnalysisRun(request(body));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid request" });
    }
    expect(runAuthenticatedPhotoAnalysis).not.toHaveBeenCalled();
  });

  it("keeps the zero-photo message actionable", async () => {
    const res = await handleMobileAnalysisRun(request({ projectId: PROJECT, photoIds: [] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Upload at least one project photo before running AI analysis.",
    });
    expect(runAuthenticatedPhotoAnalysis).not.toHaveBeenCalled();
  });

  it("rejects duplicate photo IDs as 400 before the runner", async () => {
    const res = await handleMobileAnalysisRun(
      request({ projectId: PROJECT, photoIds: [PHOTO, PHOTO] }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request" });
    expect(runAuthenticatedPhotoAnalysis).not.toHaveBeenCalled();
  });

  it("maps catalogue ceiling to the safe 400 message", async () => {
    runAuthenticatedPhotoAnalysis.mockRejectedValue(catalogueTooLargeError());
    const res = await handleMobileAnalysisRun(request({ projectId: PROJECT, photoIds: [PHOTO] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "This project has too many photos for one analysis operation.",
    });
  });

  it("maps PROJECT_NOT_AUTHORISED to 403", async () => {
    runAuthenticatedPhotoAnalysis.mockRejectedValue(
      new PhotoAnalysisError(
        PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED,
        "Photo analysis is not available for this project.",
      ),
    );
    const res = await handleMobileAnalysisRun(request({ projectId: PROJECT, photoIds: [PHOTO] }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Photo analysis is not available for this project.",
    });
  });

  it("maps exact catalogue mismatch to 409", async () => {
    runAuthenticatedPhotoAnalysis.mockRejectedValue(
      new PhotoAnalysisError(
        PHOTO_ANALYSIS_SOURCE_SET_MISMATCH,
        "The current project photos have changed. Refresh and run analysis again.",
      ),
    );
    const res = await handleMobileAnalysisRun(request({ projectId: PROJECT, photoIds: [PHOTO] }));
    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/current project photos/i);
  });

  it("maps rate-limit to 429 with Retry-After and a safe message", async () => {
    runAuthenticatedPhotoAnalysis.mockRejectedValue(
      new Error("Rate limit exceeded. Try again in 12s."),
    );
    const res = await handleMobileAnalysisRun(request({ projectId: PROJECT, photoIds: [PHOTO] }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
    expect(await res.json()).toEqual({ error: "Rate limit exceeded. Try again shortly." });
  });

  it("maps signing and provider unavailability to 503 without leaking internals", async () => {
    runAuthenticatedPhotoAnalysis.mockRejectedValueOnce(retrievalUnavailableError());
    const signRes = await handleMobileAnalysisRun(
      request({ projectId: PROJECT, photoIds: [PHOTO] }),
    );
    expect(signRes.status).toBe(503);
    expect(await signRes.json()).toEqual({ error: "Photo analysis is temporarily unavailable." });

    runAuthenticatedPhotoAnalysis.mockRejectedValueOnce(providerUnavailableError());
    const providerRes = await handleMobileAnalysisRun(
      request({ projectId: PROJECT, photoIds: [PHOTO] }),
    );
    expect(providerRes.status).toBe(503);
    expect(JSON.stringify(await providerRes.json())).not.toMatch(/OPENAI_API_KEY|retrievalUrl/);
  });

  it("never echoes raw unexpected Error.message", async () => {
    runAuthenticatedPhotoAnalysis.mockRejectedValue(
      new Error("OPENAI_API_KEY=sk-secret stack at /secret"),
    );
    const res = await handleMobileAnalysisRun(request({ projectId: PROJECT, photoIds: [PHOTO] }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Photo analysis failed." });
  });

  it("injects the Bearer supabase client and exact-catalogue mode", async () => {
    runAuthenticatedPhotoAnalysis.mockResolvedValue([analysis()]);
    const res = await handleMobileAnalysisRun(request({ projectId: PROJECT, photoIds: [PHOTO] }));
    expect(res.status).toBe(200);
    expect(runAuthenticatedPhotoAnalysis).toHaveBeenCalledWith({
      userId: "user-1",
      supabase: { marker: "bearer-client" },
      projectId: PROJECT,
      photoIds: [PHOTO],
      catalogueMode: "exact",
    });
    const json = await res.json();
    expect(json).toEqual([analysis()]);
    expect(JSON.stringify(json)).not.toMatch(/retrievalUrl|Bearer |token=/);
  });
});
