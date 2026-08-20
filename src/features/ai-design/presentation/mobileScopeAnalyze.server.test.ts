import { describe, expect, it, vi, beforeEach } from "vitest";

const requireMobileBearer = vi.fn();
const runAuthenticatedScopeAnalysis = vi.fn();

vi.mock("@/platform/http/mobile-bearer.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/platform/http/mobile-bearer.server")>();
  return {
    ...actual,
    requireMobileBearer: (...args: unknown[]) => requireMobileBearer(...args),
  };
});

vi.mock("../infrastructure/runAuthenticatedScopeAnalysis.server", () => ({
  runAuthenticatedScopeAnalysis: (...args: unknown[]) => runAuthenticatedScopeAnalysis(...args),
}));

const { handleMobileScopeAnalyze } = await import("./mobileScopeAnalyze.server");

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PHOTO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

function authed() {
  return {
    ok: true as const,
    userId: "user-token",
    user: { id: "user-token" },
    supabase: { from: vi.fn(), storage: { from: vi.fn() } },
    token: "synthetic",
  };
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    projectId: PROJECT,
    photos: [{ id: PHOTO, url: "https://evil.example/stolen.jpg", name: "room.jpg" }],
    roomTags: ["Kitchen"],
    propertyType: "Terraced",
    bedrooms: 3,
    region: "London",
    ...overrides,
  };
}

function request(body: unknown) {
  return new Request("https://www.refurbgenius.info/api/mobile/v1/scope/analyze", {
    method: "POST",
    headers: {
      Origin: "capacitor://localhost",
      Authorization: "Bearer synthetic",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("handleMobileScopeAnalyze", () => {
  beforeEach(() => {
    requireMobileBearer.mockReset();
    runAuthenticatedScopeAnalysis.mockReset();
  });

  it("unauthenticated → 401 and does not analyse", async () => {
    requireMobileBearer.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });
    const res = await handleMobileScopeAnalyze(request(validBody()));
    expect(res.status).toBe(401);
    expect(runAuthenticatedScopeAnalysis).not.toHaveBeenCalled();
  });

  it("invalid JSON → 400", async () => {
    requireMobileBearer.mockResolvedValue(authed());
    const res = await handleMobileScopeAnalyze(
      new Request("https://www.refurbgenius.info/api/mobile/v1/scope/analyze", {
        method: "POST",
        headers: {
          Origin: "capacitor://localhost",
          Authorization: "Bearer synthetic",
          "content-type": "application/json",
        },
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
    expect(runAuthenticatedScopeAnalysis).not.toHaveBeenCalled();
  });

  it("forged userId cannot become authority", async () => {
    requireMobileBearer.mockResolvedValue(authed());
    runAuthenticatedScopeAnalysis.mockResolvedValue({
      overall_score: 6,
      summary: "ok",
      rooms: [
        {
          room: "Kitchen",
          condition_summary: "ok",
          issues: [],
          recommended_items: [],
        },
      ],
    });

    const res = await handleMobileScopeAnalyze(request(validBody({ userId: "attacker" })));

    expect(res.status).toBe(200);
    const arg = runAuthenticatedScopeAnalysis.mock.calls[0]?.[0] as {
      userId: string;
      analysis: { photos: Array<{ url: string }> };
    };
    expect(arg.userId).toBe("user-token");
    expect(arg.analysis.photos[0]?.url).toBe("https://evil.example/stolen.jpg");
  });

  it("rate limit is 429", async () => {
    requireMobileBearer.mockResolvedValue(authed());
    runAuthenticatedScopeAnalysis.mockRejectedValue(
      new Error("Rate limit exceeded. Try again in 12s."),
    );
    const res = await handleMobileScopeAnalyze(request(validBody()));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
  });
});
