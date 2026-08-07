/**
 * P0-PHOTO-ANALYZE-R3 — server analysis authority resolver (redesign boundary).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Tables } from "@repo/supabase";
import {
  PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED,
  PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS,
} from "@/features/ai-upload";

const { from, createSupabaseServerClient } = vi.hoisted(() => {
  const from = vi.fn();
  const createSupabaseServerClient = vi.fn(async () => ({ from }));
  return { from, createSupabaseServerClient };
});

vi.mock("@/serverFns/auth.server", () => ({
  createSupabaseServerClient,
}));

import {
  mapRoomAnalysisRow,
  resolveCurrentProjectAnalysisAuthority,
} from "./resolveProjectAnalysisAuthority.server";

type Chain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function makeChain(final: unknown): Chain {
  const chain: Chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockResolvedValue(final);
  chain.maybeSingle.mockResolvedValue(final);
  return chain;
}

function analysisRow(photoId: string | null, overrides: Partial<Tables<"room_analyses">> = {}) {
  return {
    id: `row-${photoId ?? "null"}`,
    project_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    user_id: "11111111-1111-4111-8111-111111111111",
    photo_id: photoId,
    photo_url: photoId ? `https://cdn/${photoId}.jpg` : "https://cdn/legacy.jpg",
    photo_name: photoId ? `${photoId}.jpg` : "legacy.jpg",
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

describe("resolveCurrentProjectAnalysisAuthority (R3)", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
  const p1 = "11111111-aaaa-4aaa-8aaa-111111111111";
  const p2 = "22222222-aaaa-4aaa-8aaa-222222222222";
  const p3 = "33333333-aaaa-4aaa-8aaa-333333333333";
  const p4 = "44444444-aaaa-4aaa-8aaa-444444444444";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockTables(opts: {
    project?: { data: { id: string } | null; error?: unknown };
    photos?: { data: Array<{ id: string; url: string; name: string }> | null; error?: unknown };
    analyses?: { data: Tables<"room_analyses">[] | null; error?: unknown };
  }) {
    from.mockImplementation((table: string) => {
      if (table === "projects") {
        return makeChain(opts.project ?? { data: { id: projectId }, error: null });
      }
      if (table === "photos") {
        return makeChain(
          opts.photos ?? {
            data: [
              { id: p1, url: `https://cdn/${p1}.jpg`, name: `${p1}.jpg` },
              { id: p2, url: `https://cdn/${p2}.jpg`, name: `${p2}.jpg` },
              { id: p3, url: `https://cdn/${p3}.jpg`, name: `${p3}.jpg` },
            ],
            error: null,
          },
        );
      }
      if (table === "room_analyses") {
        return makeChain(
          opts.analyses ?? {
            data: [analysisRow(p1), analysisRow(p2), analysisRow(p3)],
            error: null,
          },
        );
      }
      return makeChain({ data: null, error: null });
    });
  }

  it("AA: valid complete authority → PASS", async () => {
    mockTables({});
    const out = await resolveCurrentProjectAnalysisAuthority({ userId, projectId });
    expect(out.map((a) => a.photo_id)).toEqual([p1, p2, p3]);
  });

  it("AB: same-count stale P1,P2,P3 vs catalogue P1,P2,P4 → REJECT", async () => {
    mockTables({
      photos: {
        data: [
          { id: p1, url: `https://cdn/${p1}.jpg`, name: `${p1}.jpg` },
          { id: p2, url: `https://cdn/${p2}.jpg`, name: `${p2}.jpg` },
          { id: p4, url: `https://cdn/${p4}.jpg`, name: `${p4}.jpg` },
        ],
        error: null,
      },
      analyses: {
        data: [analysisRow(p1), analysisRow(p2), analysisRow(p3)],
        error: null,
      },
    });
    await expect(
      resolveCurrentProjectAnalysisAuthority({ userId, projectId }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS });
  });

  it("AC: incomplete persisted P1 only → REJECT", async () => {
    mockTables({
      analyses: { data: [analysisRow(p1)], error: null },
    });
    await expect(
      resolveCurrentProjectAnalysisAuthority({ userId, projectId }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS });
  });

  it("D: mock analysis → REJECT", async () => {
    mockTables({
      photos: {
        data: [{ id: p1, url: `https://cdn/${p1}.jpg`, name: `${p1}.jpg` }],
        error: null,
      },
      analyses: {
        data: [analysisRow(p1, { source: "mock" })],
        error: null,
      },
    });
    await expect(
      resolveCurrentProjectAnalysisAuthority({ userId, projectId }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS });
  });

  it("E: photo_id-null legacy → REJECT", async () => {
    mockTables({
      photos: {
        data: [{ id: p1, url: `https://cdn/${p1}.jpg`, name: `${p1}.jpg` }],
        error: null,
      },
      analyses: {
        data: [analysisRow(null, { photo_url: `https://cdn/${p1}.jpg`, photo_name: `${p1}.jpg` })],
        error: null,
      },
    });
    await expect(
      resolveCurrentProjectAnalysisAuthority({ userId, projectId }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS });
  });

  it("F: duplicate photo_ids → REJECT", async () => {
    mockTables({
      photos: {
        data: [
          { id: p1, url: `https://cdn/${p1}.jpg`, name: `${p1}.jpg` },
          { id: p2, url: `https://cdn/${p2}.jpg`, name: `${p2}.jpg` },
        ],
        error: null,
      },
      analyses: {
        data: [analysisRow(p1), analysisRow(p1, { id: "dup-2" })],
        error: null,
      },
    });
    await expect(
      resolveCurrentProjectAnalysisAuthority({ userId, projectId }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS });
  });

  it("AK: photo catalogue read failure → fail closed", async () => {
    mockTables({
      photos: { data: null, error: { message: "db down" } },
    });
    await expect(
      resolveCurrentProjectAnalysisAuthority({ userId, projectId }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS });
  });

  it("AL: room-analysis read failure → fail closed", async () => {
    mockTables({
      analyses: { data: null, error: { message: "db down" } },
    });
    await expect(
      resolveCurrentProjectAnalysisAuthority({ userId, projectId }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS });
  });

  it("unauthorized project → PROJECT_NOT_AUTHORISED", async () => {
    mockTables({
      project: { data: null, error: null },
    });
    await expect(
      resolveCurrentProjectAnalysisAuthority({ userId, projectId }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED });
  });

  it("mapRoomAnalysisRow preserves durable photo_id", () => {
    const mapped = mapRoomAnalysisRow(analysisRow(p1));
    expect(mapped.photo_id).toBe(p1);
    expect(mapped.id).toBe(`row-${p1}`);
  });
});
