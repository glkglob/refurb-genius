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

import { SupabaseRoomAnalysisRepository } from "./room-analysis.repository";

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
