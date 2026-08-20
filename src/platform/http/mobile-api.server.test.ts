import { describe, it, expect, vi, beforeEach } from "vitest";

const requireMobileBearer = vi.fn();
const handleMobileRedesignGenerate = vi.fn();
const handleMobileAnalysisRun = vi.fn();
const handleMobileAccountDelete = vi.fn();
const handleMobileScopeAnalyze = vi.fn();

vi.mock("./mobile-bearer.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./mobile-bearer.server")>();
  return {
    ...actual,
    requireMobileBearer: (...args: unknown[]) => requireMobileBearer(...args),
  };
});

vi.mock("@/features/ai-design/presentation/mobileRedesignGenerate.server", () => ({
  handleMobileRedesignGenerate: (...args: unknown[]) => handleMobileRedesignGenerate(...args),
}));

vi.mock("@/features/ai-upload/presentation/mobileAnalysisRun.server", () => ({
  handleMobileAnalysisRun: (...args: unknown[]) => handleMobileAnalysisRun(...args),
}));

vi.mock("@/features/account-deletion/presentation/mobileAccountDelete.server", () => ({
  handleMobileAccountDelete: (...args: unknown[]) => handleMobileAccountDelete(...args),
}));

vi.mock("@/features/ai-design/presentation/mobileScopeAnalyze.server", () => ({
  handleMobileScopeAnalyze: (...args: unknown[]) => handleMobileScopeAnalyze(...args),
}));

import { handleMobileApiRequest, MOBILE_SESSION_PING_PATHNAME } from "./mobile-api.server";

describe("handleMobileApiRequest session ping canary", () => {
  beforeEach(() => {
    requireMobileBearer.mockReset();
    handleMobileRedesignGenerate.mockReset();
    handleMobileAnalysisRun.mockReset();
    handleMobileAccountDelete.mockReset();
    handleMobileScopeAnalyze.mockReset();
  });

  it("OPTIONS is unauthenticated preflight", async () => {
    const res = await handleMobileApiRequest(
      new Request(`https://www.refurbgenius.info${MOBILE_SESSION_PING_PATHNAME}`, {
        method: "OPTIONS",
        headers: { Origin: "capacitor://localhost" },
      }),
    );
    expect(res.status).toBe(204);
    expect(requireMobileBearer).not.toHaveBeenCalled();
    expect(await res.text()).toBe("");
  });

  it("POST without auth returns 401", async () => {
    requireMobileBearer.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const res = await handleMobileApiRequest(
      new Request(`https://www.refurbgenius.info${MOBILE_SESSION_PING_PATHNAME}`, {
        method: "POST",
        headers: {
          Origin: "capacitor://localhost",
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );

    expect(res.status).toBe(401);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("capacitor://localhost");
  });

  it("POST with valid bearer returns authenticated true only", async () => {
    requireMobileBearer.mockResolvedValue({
      ok: true,
      userId: "user-1",
      user: { id: "user-1" },
      supabase: {},
      token: "synthetic",
    });

    const res = await handleMobileApiRequest(
      new Request(`https://www.refurbgenius.info${MOBILE_SESSION_PING_PATHNAME}`, {
        method: "POST",
        headers: {
          Origin: "capacitor://localhost",
          Authorization: "Bearer synthetic",
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: "attacker" }),
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toEqual({ authenticated: true });
    expect(json).not.toHaveProperty("token");
    expect(json).not.toHaveProperty("userId");
    expect(json).not.toHaveProperty("access_token");
  });

  it("unknown path is 404", async () => {
    const res = await handleMobileApiRequest(
      new Request("https://www.refurbgenius.info/api/mobile/v1/nope", {
        method: "POST",
        headers: { Origin: "capacitor://localhost" },
      }),
    );
    expect(res.status).toBe(404);
    expect(requireMobileBearer).not.toHaveBeenCalled();
  });

  it("POST generate is dispatched to the Bearer generate handler", async () => {
    handleMobileRedesignGenerate.mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const res = await handleMobileApiRequest(
      new Request("https://www.refurbgenius.info/api/mobile/v1/redesign/generate", {
        method: "POST",
        headers: {
          Origin: "capacitor://localhost",
          Authorization: "Bearer synthetic",
          "content-type": "application/json",
        },
        body: JSON.stringify({ projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" }),
      }),
    );
    expect(handleMobileRedesignGenerate).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("capacitor://localhost");
  });

  it("POST analysis/run is dispatched to the Bearer analysis handler", async () => {
    handleMobileAnalysisRun.mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const res = await handleMobileApiRequest(
      new Request("https://www.refurbgenius.info/api/mobile/v1/analysis/run", {
        method: "POST",
        headers: {
          Origin: "capacitor://localhost",
          Authorization: "Bearer synthetic",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
          photoIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"],
        }),
      }),
    );
    expect(handleMobileAnalysisRun).toHaveBeenCalledTimes(1);
    expect(handleMobileRedesignGenerate).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("capacitor://localhost");
  });

  it("POST account/delete is dispatched to the Bearer delete handler", async () => {
    handleMobileAccountDelete.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const res = await handleMobileApiRequest(
      new Request("https://www.refurbgenius.info/api/mobile/v1/account/delete", {
        method: "POST",
        headers: {
          Origin: "capacitor://localhost",
          Authorization: "Bearer synthetic",
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: "attacker" }),
      }),
    );
    expect(handleMobileAccountDelete).toHaveBeenCalledTimes(1);
    expect(handleMobileAnalysisRun).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("capacitor://localhost");
  });

  it("POST scope/analyze is dispatched to the Bearer scope handler", async () => {
    handleMobileScopeAnalyze.mockResolvedValue(
      new Response(
        JSON.stringify({ overall_score: 6, summary: "ok", rooms: [{ room: "Kitchen" }] }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const res = await handleMobileApiRequest(
      new Request("https://www.refurbgenius.info/api/mobile/v1/scope/analyze", {
        method: "POST",
        headers: {
          Origin: "capacitor://localhost",
          Authorization: "Bearer synthetic",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
          photos: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", url: "x", name: "a.jpg" }],
          roomTags: ["Kitchen"],
          propertyType: "Terraced",
          bedrooms: 3,
          region: "London",
        }),
      }),
    );
    expect(handleMobileScopeAnalyze).toHaveBeenCalledTimes(1);
    expect(handleMobileAccountDelete).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("GET on generate is 405 and does not authenticate", async () => {
    const res = await handleMobileApiRequest(
      new Request("https://www.refurbgenius.info/api/mobile/v1/redesign/generate", {
        method: "GET",
        headers: { Origin: "capacitor://localhost" },
      }),
    );
    expect(res.status).toBe(405);
    expect(requireMobileBearer).not.toHaveBeenCalled();
  });
});
