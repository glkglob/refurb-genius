import { describe, it, expect, vi, beforeEach } from "vitest";

const { getUser, rpc, from } = vi.hoisted(() => {
  const rpc = vi.fn();
  const from = vi.fn();
  return {
    getUser: vi.fn(() => ({ id: "user-1" }) as { id: string } | null),
    rpc,
    from,
  };
});

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    rpc,
    from,
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    getUser,
    onChange: vi.fn(() => () => undefined),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/queries/projects", () => ({
  fetchProjectPhotosList: vi.fn(async () => []),
}));

import { SupabaseRoomAnalysisRepository, rowToAnalysis } from "./room-analysis.repository";
import type { RoomAnalysis } from "../../domain";
import type { Tables } from "@repo/supabase";

function aiRow(photoId: string): RoomAnalysis {
  return {
    id: `tmp-${photoId}`,
    photo_id: photoId,
    photo_url: `https://cdn/${photoId}.jpg`,
    photo_name: `${photoId}.jpg`,
    room_type: "Other",
    condition_level: "Average",
    refurbishment_level: "Medium",
    visible_issues: [],
    recommended_works: [],
    ai_summary: "ok",
    confidence_score: 0.8,
    source: "ai",
  };
}

describe("room-analysis repository R2 durable save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockReturnValue({ id: "user-1" });
  });

  it("L: rowToAnalysis maps durable photo_id", () => {
    const row = {
      id: "analysis-row",
      project_id: "proj",
      user_id: "user-1",
      photo_id: "photo-uuid",
      photo_url: "https://cdn/p.jpg",
      photo_name: "p.jpg",
      room_type: "Kitchen",
      condition_level: "Average",
      refurbishment_level: "Medium",
      visible_issues: [],
      recommended_works: [],
      ai_summary: "s",
      confidence_score: 0.5,
      source: "ai",
      created_at: "2026-01-01T00:00:00Z",
    } as unknown as Tables<"room_analyses">;
    const mapped = rowToAnalysis(row);
    expect(mapped.id).toBe("analysis-row");
    expect(mapped.photo_id).toBe("photo-uuid");
  });

  it("M/Q: RPC failure rejects and leaves prior cache unchanged", async () => {
    const repo = new SupabaseRoomAnalysisRepository();
    // seed cache via successful save first
    rpc.mockResolvedValueOnce({
      data: [
        {
          id: "row-1",
          project_id: "proj",
          user_id: "user-1",
          photo_id: "p1",
          photo_url: "https://cdn/p1.jpg",
          photo_name: "p1.jpg",
          room_type: "Other",
          condition_level: "Average",
          refurbishment_level: "Medium",
          visible_issues: [],
          recommended_works: [],
          ai_summary: "ok",
          confidence_score: 0.8,
          source: "ai",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    });
    await repo.save("proj", [aiRow("p1")]);
    expect(repo.get("proj")?.[0]?.photo_id).toBe("p1");

    rpc.mockResolvedValueOnce({ data: null, error: { message: "insert failed" } });
    await expect(repo.save("proj", [aiRow("p2")])).rejects.toThrow(/insert failed|Failed to save/);
    // prior cache restored
    expect(repo.get("proj")?.[0]?.photo_id).toBe("p1");
  });

  it("W: mock save throws without calling RPC", async () => {
    const repo = new SupabaseRoomAnalysisRepository();
    await expect(
      repo.save("proj", [
        {
          ...aiRow("p1"),
          source: "mock",
        },
      ]),
    ).rejects.toThrow(/Mock analysis/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("unauthenticated save rejects", async () => {
    getUser.mockReturnValue(null);
    const repo = new SupabaseRoomAnalysisRepository();
    await expect(repo.save("proj", [aiRow("p1")])).rejects.toThrow(
      /not authenticated|Failed to save/,
    );
  });
});
