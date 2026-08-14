import { describe, expect, it, vi, beforeEach } from "vitest";
import { PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS, PhotoAnalysisError } from "@/features/ai-upload";

const requireMobileBearer = vi.fn();
const runAuthenticatedRedesignGeneration = vi.fn();

vi.mock("@/platform/http/mobile-bearer.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/platform/http/mobile-bearer.server")>();
  return {
    ...actual,
    requireMobileBearer: (...args: unknown[]) => requireMobileBearer(...args),
  };
});

vi.mock("../infrastructure/runAuthenticatedRedesignGeneration.server", () => ({
  runAuthenticatedRedesignGeneration: (...args: unknown[]) =>
    runAuthenticatedRedesignGeneration(...args),
}));

const { handleMobileRedesignGenerate } = await import("./mobileRedesignGenerate.server");

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
  return new Request("https://www.refurbgenius.info/api/mobile/v1/redesign/generate", {
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

describe("handleMobileRedesignGenerate", () => {
  beforeEach(() => {
    requireMobileBearer.mockReset();
    runAuthenticatedRedesignGeneration.mockReset();
  });

  it("unauthenticated → 401 and does not generate", async () => {
    requireMobileBearer.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });
    const res = await handleMobileRedesignGenerate(request({ projectId: PROJECT }));
    expect(res.status).toBe(401);
    expect(runAuthenticatedRedesignGeneration).not.toHaveBeenCalled();
  });

  it("invalid body → 400", async () => {
    requireMobileBearer.mockResolvedValue(authed());
    const res = await handleMobileRedesignGenerate(request({ projectId: "not-a-uuid" }));
    expect(res.status).toBe(400);
    expect(runAuthenticatedRedesignGeneration).not.toHaveBeenCalled();
  });

  it("forged userId cannot become authority", async () => {
    requireMobileBearer.mockResolvedValue(authed());
    runAuthenticatedRedesignGeneration.mockResolvedValue([]);

    const res = await handleMobileRedesignGenerate(
      request({
        projectId: PROJECT,
        userId: "attacker",
        analyses: [{ photo_id: "forged" }],
      }),
    );

    expect(res.status).toBe(200);
    expect(runAuthenticatedRedesignGeneration).toHaveBeenCalledTimes(1);
    const arg = runAuthenticatedRedesignGeneration.mock.calls[0]?.[0] as {
      userId: string;
      projectId: string;
      styles?: unknown;
    };
    expect(arg.userId).toBe("user-token");
    expect(arg.projectId).toBe(PROJECT);
    expect(arg).not.toHaveProperty("analyses");
  });

  it("authenticated valid request returns typed concepts", async () => {
    requireMobileBearer.mockResolvedValue(authed());
    runAuthenticatedRedesignGeneration.mockResolvedValue([
      { id: "c1", style: "Modern", isSelected: false },
    ]);
    const res = await handleMobileRedesignGenerate(request({ projectId: PROJECT }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: "c1", style: "Modern", isSelected: false }]);
    expect(runAuthenticatedRedesignGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-token",
        projectId: PROJECT,
        supabase: expect.anything(),
      }),
    );
  });

  it("stale Analysis is 409 and does not look like success", async () => {
    requireMobileBearer.mockResolvedValue(authed());
    runAuthenticatedRedesignGeneration.mockRejectedValue(
      new PhotoAnalysisError(PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS, "stale"),
    );
    const res = await handleMobileRedesignGenerate(request({ projectId: PROJECT }));
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "stale" });
  });

  it("rate limit is 429 with the shared bucket message", async () => {
    requireMobileBearer.mockResolvedValue(authed());
    runAuthenticatedRedesignGeneration.mockRejectedValue(
      new Error("Rate limit exceeded. Try again in 42s."),
    );
    const res = await handleMobileRedesignGenerate(request({ projectId: PROJECT }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    await expect(res.json()).resolves.toEqual({
      error: "Rate limit exceeded. Try again in 42s.",
    });
  });
});
