/**
 * P0-PHOTO-ANALYZE-R3/R4 — server analysis authority via serialized RPC.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Tables } from "@repo/supabase";
import {
  PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED,
  PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS,
} from "@/features/ai-upload";

const { rpc, createSupabaseServerClient } = vi.hoisted(() => {
  const rpc = vi.fn();
  const createSupabaseServerClient = vi.fn(async () => ({ rpc }));
  return { rpc, createSupabaseServerClient };
});

vi.mock("@/serverFns/auth.server", () => ({
  createSupabaseServerClient,
}));

import {
  mapRoomAnalysisRow,
  resolveCurrentProjectAnalysisAuthority,
} from "./resolveProjectAnalysisAuthority.server";

function analysisRow(photoId: string, overrides: Partial<Tables<"room_analyses">> = {}) {
  return {
    id: `row-${photoId}`,
    project_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    user_id: "11111111-1111-4111-8111-111111111111",
    photo_id: photoId,
    photo_url: `https://cdn/${photoId}.jpg`,
    photo_name: `${photoId}.jpg`,
    room_type: "Kitchen",
    condition_level: "Average",
    refurbishment_level: "Medium",
    visible_issues: [],
    recommended_works: [],
    ai_summary: "ok",
    confidence_score: 0.9,
    source: "ai",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as unknown as Tables<"room_analyses">;
}

describe("resolveCurrentProjectAnalysisAuthority (R4 RPC)", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
  const p1 = "11111111-aaaa-4aaa-8aaa-111111111111";
  const p2 = "22222222-aaaa-4aaa-8aaa-222222222222";
  const p3 = "33333333-aaaa-4aaa-8aaa-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AA: valid complete authority via RPC → PASS", async () => {
    rpc.mockResolvedValueOnce({
      data: [analysisRow(p1), analysisRow(p2), analysisRow(p3)],
      error: null,
    });
    const out = await resolveCurrentProjectAnalysisAuthority({ userId, projectId });
    expect(rpc).toHaveBeenCalledWith("get_current_project_analysis_authority", {
      p_project_id: projectId,
    });
    expect(out.map((a) => a.photo_id)).toEqual([p1, p2, p3]);
  });

  it("AB/AC: RPC stale → REJECT", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "stale_requires_reanalysis" },
    });
    await expect(
      resolveCurrentProjectAnalysisAuthority({ userId, projectId }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS });
  });

  it("unauthorized project → PROJECT_NOT_AUTHORISED", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "project_not_authorised" },
    });
    await expect(
      resolveCurrentProjectAnalysisAuthority({ userId, projectId }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED });
  });

  it("AK/AL: empty RPC response → fail closed", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(
      resolveCurrentProjectAnalysisAuthority({ userId, projectId }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS });
  });

  it("mapRoomAnalysisRow preserves durable photo_id", () => {
    const mapped = mapRoomAnalysisRow(analysisRow(p1));
    expect(mapped.photo_id).toBe(p1);
  });
});
