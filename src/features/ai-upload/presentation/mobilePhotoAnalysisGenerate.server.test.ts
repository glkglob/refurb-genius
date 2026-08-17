import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  PHOTO_ANALYSIS_NO_SOURCE_PHOTOS,
  PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED,
  PHOTO_ANALYSIS_PERSISTENCE_FAILED,
  PhotoAnalysisError,
} from "../domain";

const requireMobileBearer = vi.fn();
const runAuthenticatedPhotoAnalysis = vi.fn();

vi.mock("@/platform/http/mobile-bearer.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/platform/http/mobile-bearer.server")>();
  return {
    ...actual,
    requireMobileBearer: (...args: unknown[]) => requireMobileBearer(...args),
  };
});

vi.mock("../infrastructure/runAuthenticatedPhotoAnalysis.server", () => ({
  runAuthenticatedPhotoAnalysis: (...args: unknown[]) => runAuthenticatedPhotoAnalysis(...args),
}));

const { handleMobilePhotoAnalysisGenerate } = await import("./mobilePhotoAnalysisGenerate.server");

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

function authed() {
  return {
    ok: true as const,
    userId: "user-token",
    user: { id: "user-token" },
    supabase: { rpc: vi.fn(), from: vi.fn() },
    token: "synthetic",
  };
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://www.refurbgenius.info/api/mobile/v1/analysis/generate", {
    method: "POST",
    headers: {
      Origin: "capacitor://localhost",
      Authorization: "Bearer synthetic",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("handleMobilePhotoAnalysisGenerate", () => {
  beforeEach(() => {
    requireMobileBearer.mockReset();
    runAuthenticatedPhotoAnalysis.mockReset();
  });

  it("missing/invalid bearer → 401 and does not analyse", async () => {
    requireMobileBearer.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });
    const res = await handleMobilePhotoAnalysisGenerate(request({ projectId: PROJECT }));
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Unauthorized");
    expect(JSON.stringify(json)).not.toMatch(/Bearer |eyJ|synthetic/);
    expect(runAuthenticatedPhotoAnalysis).not.toHaveBeenCalled();
  });

  it("invalid JSON → 400", async () => {
    requireMobileBearer.mockResolvedValue(authed());
    const res = await handleMobilePhotoAnalysisGenerate(
      new Request("https://www.refurbgenius.info/api/mobile/v1/analysis/generate", {
        method: "POST",
        headers: {
          Authorization: "Bearer synthetic",
          "content-type": "application/json",
        },
        body: "{",
      }),
    );
    expect(res.status).toBe(400);
    expect(runAuthenticatedPhotoAnalysis).not.toHaveBeenCalled();
  });

  it("invalid/missing projectId → 400", async () => {
    requireMobileBearer.mockResolvedValue(authed());
    const res = await handleMobilePhotoAnalysisGenerate(request({ projectId: "not-a-uuid" }));
    expect(res.status).toBe(400);
    expect(runAuthenticatedPhotoAnalysis).not.toHaveBeenCalled();
  });

  it("forged userId cannot become authority", async () => {
    requireMobileBearer.mockResolvedValue(authed());
    runAuthenticatedPhotoAnalysis.mockResolvedValue([]);

    const res = await handleMobilePhotoAnalysisGenerate(
      request({
        projectId: PROJECT,
        userId: "attacker",
        photoIds: ["forged"],
      }),
    );

    expect(res.status).toBe(200);
    expect(runAuthenticatedPhotoAnalysis).toHaveBeenCalledTimes(1);
    const arg = runAuthenticatedPhotoAnalysis.mock.calls[0]?.[0] as {
      userId: string;
      projectId: string;
    };
    expect(arg.userId).toBe("user-token");
    expect(arg.projectId).toBe(PROJECT);
    expect(arg).not.toHaveProperty("photoIds");
    expect(arg).not.toHaveProperty("userIdClaim");
  });

  it("owner project returns analyses", async () => {
    requireMobileBearer.mockResolvedValue(authed());
    runAuthenticatedPhotoAnalysis.mockResolvedValue([{ id: "a1", photo_id: "p1", source: "ai" }]);
    const res = await handleMobilePhotoAnalysisGenerate(request({ projectId: PROJECT }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: "a1", photo_id: "p1", source: "ai" }]);
  });

  it("other user's project → 403", async () => {
    requireMobileBearer.mockResolvedValue(authed());
    runAuthenticatedPhotoAnalysis.mockRejectedValue(
      new PhotoAnalysisError(PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED, "not available"),
    );
    const res = await handleMobilePhotoAnalysisGenerate(request({ projectId: PROJECT }));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "not available" });
  });

  it("zero photos → 400 and is not success", async () => {
    requireMobileBearer.mockResolvedValue(authed());
    runAuthenticatedPhotoAnalysis.mockRejectedValue(
      new PhotoAnalysisError(PHOTO_ANALYSIS_NO_SOURCE_PHOTOS, "Upload at least one project photo"),
    );
    const res = await handleMobilePhotoAnalysisGenerate(request({ projectId: PROJECT }));
    expect(res.status).toBe(400);
  });

  it("persistence failure → 500 not false success", async () => {
    requireMobileBearer.mockResolvedValue(authed());
    runAuthenticatedPhotoAnalysis.mockRejectedValue(
      new PhotoAnalysisError(PHOTO_ANALYSIS_PERSISTENCE_FAILED, "Failed to save photo analysis."),
    );
    const res = await handleMobilePhotoAnalysisGenerate(request({ projectId: PROJECT }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Failed to save photo analysis." });
  });

  it("rate limit is 429", async () => {
    requireMobileBearer.mockResolvedValue(authed());
    runAuthenticatedPhotoAnalysis.mockRejectedValue(
      new Error("Rate limit exceeded. Try again in 42s."),
    );
    const res = await handleMobilePhotoAnalysisGenerate(request({ projectId: PROJECT }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
  });
});
