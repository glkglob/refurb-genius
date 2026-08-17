vi.mock("@tanstack/react-start/server-only", () => ({}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PHOTO_ANALYSIS_MOCK_FORBIDDEN, PHOTO_ANALYSIS_PERSISTENCE_FAILED } from "../../domain";
import type { RoomAnalysis } from "../../domain";
import {
  replaceProjectRoomAnalysesWithClient,
  rowToServerAnalysis,
} from "./room-analysis.repository.server";

function aiRow(photoId: string, extra: Partial<RoomAnalysis> = {}): RoomAnalysis {
  return {
    id: `tmp-${photoId}`,
    photo_id: photoId,
    photo_url: `https://cdn/${photoId}.jpg`,
    photo_name: `${photoId}.jpg`,
    room_type: "Kitchen",
    condition_level: "Average",
    refurbishment_level: "Medium",
    visible_issues: [],
    recommended_works: [],
    ai_summary: "ok",
    confidence_score: 0.8,
    source: "ai",
    ...extra,
  };
}

describe("replaceProjectRoomAnalysesWithClient", () => {
  const rpc = vi.fn();
  const supabase = { from: vi.fn(), rpc, storage: { from: vi.fn() } };

  beforeEach(() => {
    rpc.mockReset();
  });

  it("rejects mock rows without calling RPC", async () => {
    await expect(
      replaceProjectRoomAnalysesWithClient(supabase, "proj", [aiRow("p1", { source: "mock" })]),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_MOCK_FORBIDDEN });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("persists via replace_project_room_analyses and returns mapped rows", async () => {
    const persisted = {
      id: "row-1",
      project_id: "proj",
      user_id: "user-1",
      photo_id: "p1",
      photo_url: "https://cdn/p1.jpg",
      photo_name: "p1.jpg",
      room_type: "Kitchen",
      condition_level: "Average",
      refurbishment_level: "Medium",
      visible_issues: [],
      recommended_works: [],
      ai_summary: "ok",
      confidence_score: 0.8,
      source: "ai",
      created_at: "2026-01-01T00:00:00Z",
    };
    rpc.mockResolvedValue({ data: [persisted], error: null });

    const out = await replaceProjectRoomAnalysesWithClient(supabase, "proj", [aiRow("p1")]);

    expect(rpc).toHaveBeenCalledWith("replace_project_room_analyses", {
      p_project_id: "proj",
      p_analyses: [
        expect.objectContaining({
          photo_id: "p1",
          source: "ai",
        }),
      ],
    });
    expect(out[0]?.photo_id).toBe("p1");
    expect(out[0]?.id).toBe("row-1");
  });

  it("RPC error is a persistence failure, not success", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "rls denied" } });
    await expect(
      replaceProjectRoomAnalysesWithClient(supabase, "proj", [aiRow("p1")]),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_PERSISTENCE_FAILED });
  });

  it("empty RPC response is a persistence failure", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(
      replaceProjectRoomAnalysesWithClient(supabase, "proj", [aiRow("p1")]),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_PERSISTENCE_FAILED });
  });
});

describe("rowToServerAnalysis", () => {
  it("maps durable photo_id", () => {
    const mapped = rowToServerAnalysis({
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
    } as never);
    expect(mapped.photo_id).toBe("photo-uuid");
  });
});
