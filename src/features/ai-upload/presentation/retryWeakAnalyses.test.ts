import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomAnalysis } from "../domain";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "retryWeakAnalyses.ts"),
  "utf8",
);
const PROVIDER_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "photo-analysis.provider.ts"),
  "utf8",
);

const { isNativePlatform, analyzePhotosForClient, listPhotos, load, save } = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  analyzePhotosForClient: vi.fn(),
  listPhotos: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("./analyzePhotosForClient", () => ({
  analyzePhotosForClient: (...args: unknown[]) => analyzePhotosForClient(...args),
}));

vi.mock("../infrastructure/repositories/photo-catalog.repository", () => ({
  browserPhotoCatalogRepository: {
    listPhotos: (...args: unknown[]) => listPhotos(...args),
  },
}));

vi.mock("../infrastructure/repositories/room-analysis.repository", () => ({
  supabaseRoomAnalysisRepository: {
    get: vi.fn(),
    load: (...args: unknown[]) => load(...args),
    save: (...args: unknown[]) => save(...args),
    subscribe: vi.fn(() => () => undefined),
  },
}));

import { retryWeakPhotoAnalyses } from "./retryWeakAnalyses";

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const STRONG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const WEAK = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";

const PHOTO_META: Record<string, { url: string; name: string }> = {
  [STRONG]: { url: "https://cdn/s.jpg", name: "s.jpg" },
  [WEAK]: { url: "https://cdn/w.jpg", name: "w.jpg" },
};

function analysis(photoId: string, overrides: Partial<RoomAnalysis> = {}): RoomAnalysis {
  const meta = PHOTO_META[photoId] ?? { url: `https://cdn/${photoId}.jpg`, name: `${photoId}.jpg` };
  return {
    id: `a-${photoId}`,
    photo_id: photoId,
    photo_url: meta.url,
    photo_name: meta.name,
    room_type: "Kitchen",
    condition_level: "Average",
    refurbishment_level: "Medium",
    visible_issues: [],
    recommended_works: [],
    ai_summary: overrides.source === "fallback" ? "" : "ok",
    confidence_score: overrides.source === "fallback" ? 0 : 0.9,
    source: "ai",
    ...overrides,
  };
}

describe("retryWeakPhotoAnalyses platform dispatch", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    analyzePhotosForClient.mockReset();
    listPhotos.mockReset();
    load.mockReset();
    save.mockReset();
    listPhotos.mockResolvedValue([
      { id: STRONG, url: "https://cdn/s.jpg", name: "s.jpg" },
      { id: WEAK, url: "https://cdn/w.jpg", name: "w.jpg" },
    ]);
    load.mockResolvedValue([
      analysis(STRONG),
      analysis(WEAK, { source: "fallback", confidence_score: 0, ai_summary: "" }),
    ]);
    save.mockResolvedValue(undefined);
  });

  it("web retries only the weak subset", async () => {
    analyzePhotosForClient.mockImplementation(async (input: { photoIds: string[] }) =>
      input.photoIds.map((id) => analysis(id)),
    );

    const out = await retryWeakPhotoAnalyses({ projectId: PROJECT });

    expect(analyzePhotosForClient).toHaveBeenCalledWith({
      projectId: PROJECT,
      photoIds: [WEAK],
    });
    expect(out).toHaveLength(2);
    expect(out.map((row) => row.photo_id)).toEqual([STRONG, WEAK]);
  });

  it("native retry re-analyses the full current catalogue", async () => {
    isNativePlatform.mockReturnValue(true);
    analyzePhotosForClient.mockImplementation(async (input: { photoIds: string[] }) =>
      input.photoIds.map((id) => analysis(id)),
    );

    const out = await retryWeakPhotoAnalyses({ projectId: PROJECT });

    expect(analyzePhotosForClient).toHaveBeenCalledWith({
      projectId: PROJECT,
      photoIds: [STRONG, WEAK],
    });
    expect(out.map((row) => row.photo_id)).toEqual([STRONG, WEAK]);
  });
});

describe("retryWeakAnalyses source containment", () => {
  it("does not statically import createServerFn transport", () => {
    expect(SRC).not.toMatch(/from\s+["']\.\/serverFns["']/);
    expect(SRC).not.toMatch(/runPhotoAnalysisServerFn/);
    expect(SRC).toMatch(/analyzePhotosForClient/);
    expect(SRC).toMatch(/isNativePlatform/);
    expect(PROVIDER_SRC).not.toMatch(/from\s+["']\.\/serverFns["']/);
    expect(PROVIDER_SRC).toMatch(/analyzePhotosForClient/);
  });
});
