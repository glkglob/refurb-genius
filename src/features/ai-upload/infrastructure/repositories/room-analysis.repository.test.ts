import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ProjectPhoto } from "@/lib/photos-types";

const { fetchProjectPhotosList, getUser } = vi.hoisted(() => ({
  fetchProjectPhotosList: vi.fn(),
  getUser: vi.fn(() => null as { id: string } | null),
}));

vi.mock("@/lib/queries/projects", () => ({
  fetchProjectPhotosList,
}));

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    getUser,
    onChange: vi.fn(() => () => undefined),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { jsonToStringArray, SupabaseRoomAnalysisRepository } from "./room-analysis.repository";
import type { Json, Tables } from "@repo/supabase";
import type { RoomAnalysis } from "../../domain";

function makePhoto(overrides: Partial<ProjectPhoto> = {}): ProjectPhoto {
  return {
    id: "p1",
    projectId: "proj-1",
    url: "https://example.com/a.jpg",
    name: "a.jpg",
    size: 100,
    uploadedAt: "2024-01-01T00:00:00Z",
    storagePath: "u/proj/a.jpg",
    ...overrides,
  };
}

describe("jsonToStringArray (canonical Json → domain string[])", () => {
  it("maps valid JSON string arrays to string[]", () => {
    expect(jsonToStringArray(["damp", "mould"] as Json)).toEqual(["damp", "mould"]);
  });

  it("maps empty arrays to []", () => {
    expect(jsonToStringArray([] as Json)).toEqual([]);
  });

  it("maps null and non-array JSON to []", () => {
    expect(jsonToStringArray(null)).toEqual([]);
    expect(jsonToStringArray(undefined)).toEqual([]);
    expect(jsonToStringArray("oops" as Json)).toEqual([]);
    expect(jsonToStringArray(42 as Json)).toEqual([]);
    expect(jsonToStringArray({ a: 1 } as Json)).toEqual([]);
  });

  it("retains only string elements from mixed arrays", () => {
    expect(jsonToStringArray(["ok", 1, null, "two", { x: 1 }, true] as Json)).toEqual([
      "ok",
      "two",
    ]);
  });
});

describe("row mapping keeps Json behind repository boundary", () => {
  it("maps multiple room_analyses rows including jsonb list fields", async () => {
    // Fixture rows use migration-shaped jsonb values. Cast through unknown because
    // the tracked generated types still declare these columns as string[] until B6.
    const rows = [
      {
        id: "r1",
        project_id: "proj-1",
        user_id: "u1",
        photo_id: null,
        photo_url: "https://u/1",
        photo_name: "1.jpg",
        room_type: "Kitchen",
        condition_level: "Dated",
        refurbishment_level: "Light",
        visible_issues: ["crack"],
        recommended_works: ["paint"],
        ai_summary: "s1",
        confidence_score: 0.9,
        created_at: "2024-01-01T00:00:00Z",
        source: "persisted",
      },
      {
        id: "r2",
        project_id: "proj-1",
        user_id: "u1",
        photo_id: null,
        photo_url: "https://u/2",
        photo_name: "2.jpg",
        room_type: "Bathroom",
        condition_level: "Good",
        refurbishment_level: "None",
        visible_issues: null,
        recommended_works: ["tile", 3, "grout"],
        ai_summary: "s2",
        confidence_score: 0.5,
        created_at: "2024-01-02T00:00:00Z",
        source: "ai",
      },
    ] as unknown as Tables<"room_analyses">[];

    // Exercise mapper via the same private path used by loadFromSupabase:
    // re-import module and call through load with mocked select chain.
    const { supabase } = await import("@/platform/supabase/browser");
    const from = vi.mocked(supabase.from);
    from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
      delete: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as never);

    const repo = new SupabaseRoomAnalysisRepository();
    const loaded = await repo.load("proj-1");
    expect(loaded).toHaveLength(2);
    const first = loaded![0] as RoomAnalysis;
    const second = loaded![1] as RoomAnalysis;
    expect(first.visible_issues).toEqual(["crack"]);
    expect(first.recommended_works).toEqual(["paint"]);
    expect(second.visible_issues).toEqual([]);
    expect(second.recommended_works).toEqual(["tile", "grout"]);
    // Domain objects expose string[], not raw Json bags
    expect(Array.isArray(first.visible_issues)).toBe(true);
    expect(first.visible_issues.every((x) => typeof x === "string")).toBe(true);
  });
});

describe("SupabaseRoomAnalysisRepository.runMock (C5-2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("obtains photos through fetchProjectPhotosList and preserves order in mock results", async () => {
    fetchProjectPhotosList.mockResolvedValue([
      makePhoto({ id: "first", url: "https://u/1", name: "1.jpg" }),
      makePhoto({ id: "second", url: "https://u/2", name: "2.jpg" }),
    ]);

    const repo = new SupabaseRoomAnalysisRepository();
    const pending = repo.runMock("proj-1");
    await vi.advanceTimersByTimeAsync(1200);
    const result = await pending;

    expect(fetchProjectPhotosList).toHaveBeenCalledWith("proj-1");
    expect(result.map((r) => r.id)).toEqual(["first", "second"]);
    expect(result[0]?.photo_url).toBe("https://u/1");
    expect(result[0]?.photo_name).toBe("1.jpg");
    expect(result[0]?.source).toBe("mock");
    // Saved to in-memory cache
    expect(repo.get("proj-1")).toEqual(result);
  });

  it("genuine empty list preserves FALLBACK mock behaviour", async () => {
    fetchProjectPhotosList.mockResolvedValue([]);

    const repo = new SupabaseRoomAnalysisRepository();
    const pending = repo.runMock("empty-proj");
    await vi.advanceTimersByTimeAsync(1200);
    const result = await pending;

    expect(fetchProjectPhotosList).toHaveBeenCalledWith("empty-proj");
    // buildMockRoomAnalyses substitutes FALLBACK_PHOTOS when no sources
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.source === "mock")).toBe(true);
    expect(result[0]?.id).toMatch(/^fallback-/);
  });

  it("propagates canonical fetch failures", async () => {
    fetchProjectPhotosList.mockRejectedValue(new Error("network down"));

    const repo = new SupabaseRoomAnalysisRepository();
    const pending = repo.runMock("proj-1");
    const assertion = expect(pending).rejects.toThrow("network down");
    await vi.advanceTimersByTimeAsync(1200);
    await assertion;
  });

  it("does not depend on photoStore", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(
        process.cwd(),
        "src/features/ai-upload/infrastructure/repositories/room-analysis.repository.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/photoStore/);
    expect(src).toMatch(/fetchProjectPhotosList\s*\(/);
  });
});
