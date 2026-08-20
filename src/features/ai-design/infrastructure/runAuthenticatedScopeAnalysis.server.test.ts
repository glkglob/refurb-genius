import { describe, expect, it, vi, beforeEach } from "vitest";

const checkRateLimit = vi.fn();
const runSecureScopeAnalysis = vi.fn();

vi.mock("@tanstack/react-start/server-only", () => ({}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  rateLimitKeyForUser: (userId: string, action: string) => `${userId}:${action}`,
}));

vi.mock("./adapters/ai-scope.adapter.server", () => ({
  runSecureScopeAnalysis: (...args: unknown[]) => runSecureScopeAnalysis(...args),
}));

import { runAuthenticatedScopeAnalysis } from "./runAuthenticatedScopeAnalysis.server";

const USER = "user-1";
const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PHOTO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const CLIENT_URL = "https://evil.example/stolen.jpg";

function analysis() {
  return {
    projectId: PROJECT,
    photos: [{ id: PHOTO, url: CLIENT_URL, name: "room.jpg" }],
    roomTags: ["Kitchen"],
    propertyType: "Terraced",
    bedrooms: 3,
    region: "London",
  };
}

function result() {
  return {
    overall_score: 6,
    summary: "Average condition terrace needing a medium refresh.",
    rooms: [
      {
        room: "Kitchen",
        condition_summary: "Dated but serviceable",
        issues: [
          {
            category: "Cosmetic",
            description: "Worn units",
            severity: "medium",
            recommended_action: "Replace units",
          },
        ],
        recommended_items: [
          {
            name: "Replace mid-range kitchen units",
            category: "both",
            quantity: 1,
            unit: "room",
            base_unit_cost: 8000,
          },
        ],
      },
    ],
  };
}

describe("runAuthenticatedScopeAnalysis", () => {
  beforeEach(() => {
    checkRateLimit.mockReset();
    runSecureScopeAnalysis.mockReset();
    checkRateLimit.mockReturnValue({ allowed: true });
  });

  it("passes injected auth and does not treat client URL as authority beyond the photo id", async () => {
    runSecureScopeAnalysis.mockResolvedValue(result());
    const supabase = { from: vi.fn() };

    const out = await runAuthenticatedScopeAnalysis({
      userId: USER,
      supabase: supabase as never,
      analysis: analysis(),
    });

    expect(checkRateLimit).toHaveBeenCalledWith(`${USER}:ai-scope`);
    expect(runSecureScopeAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT,
        photos: [{ id: PHOTO, url: CLIENT_URL, name: "room.jpg", size: undefined }],
      }),
      { userId: USER, supabase },
    );
    expect(out.rooms[0]?.room).toBe("Kitchen");
  });

  it("throws on rate limit before calling the adapter", async () => {
    checkRateLimit.mockReturnValue({ allowed: false, retryAfter: 9 });
    await expect(
      runAuthenticatedScopeAnalysis({
        userId: USER,
        supabase: { from: vi.fn() } as never,
        analysis: analysis(),
      }),
    ).rejects.toThrow(/Rate limit exceeded/);
    expect(runSecureScopeAnalysis).not.toHaveBeenCalled();
  });

  it("fail-closes a malformed adapter payload", async () => {
    runSecureScopeAnalysis.mockResolvedValue({ overall_score: 6, summary: "x" });
    await expect(
      runAuthenticatedScopeAnalysis({
        userId: USER,
        supabase: { from: vi.fn() } as never,
        analysis: analysis(),
      }),
    ).rejects.toThrow(/not a result/);
  });
});
