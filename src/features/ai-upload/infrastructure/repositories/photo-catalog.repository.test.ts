import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProjectPhoto } from "@/lib/photos-types";

const { fetchProjectPhotosList } = vi.hoisted(() => ({
  fetchProjectPhotosList: vi.fn(),
}));

vi.mock("@/lib/queries/projects", () => ({
  fetchProjectPhotosList,
}));

import { BrowserPhotoCatalogRepository } from "./photo-catalog.repository";

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

describe("BrowserPhotoCatalogRepository (C5-2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls fetchProjectPhotosList with project id and maps AnalysisPhotoSource fields", async () => {
    fetchProjectPhotosList.mockResolvedValue([
      makePhoto({ id: "a", url: "https://u/a", name: "a.jpg", size: 1 }),
      makePhoto({ id: "b", url: "https://u/b", name: "b.jpg", size: 2 }),
    ]);

    const repo = new BrowserPhotoCatalogRepository();
    const out = await repo.listPhotos("proj-1");

    expect(fetchProjectPhotosList).toHaveBeenCalledTimes(1);
    expect(fetchProjectPhotosList).toHaveBeenCalledWith("proj-1");
    expect(out).toEqual([
      { id: "a", url: "https://u/a", name: "a.jpg", size: 1 },
      { id: "b", url: "https://u/b", name: "b.jpg", size: 2 },
    ]);
    // No extra ProjectPhoto fields leaked
    expect(Object.keys(out[0]!)).toEqual(["id", "url", "name", "size"]);
  });

  it("preserves source ordering", async () => {
    fetchProjectPhotosList.mockResolvedValue([
      makePhoto({ id: "first", name: "1.jpg" }),
      makePhoto({ id: "second", name: "2.jpg" }),
      makePhoto({ id: "third", name: "3.jpg" }),
    ]);

    const repo = new BrowserPhotoCatalogRepository();
    const out = await repo.listPhotos("proj-x");
    expect(out.map((p) => p.id)).toEqual(["first", "second", "third"]);
  });

  it("returns [] for empty result", async () => {
    fetchProjectPhotosList.mockResolvedValue([]);
    const repo = new BrowserPhotoCatalogRepository();
    await expect(repo.listPhotos("empty")).resolves.toEqual([]);
  });

  it("propagates canonical fetch errors", async () => {
    fetchProjectPhotosList.mockRejectedValue(new Error("boom"));
    const repo = new BrowserPhotoCatalogRepository();
    await expect(repo.listPhotos("proj-1")).rejects.toThrow("boom");
  });

  it("does not import or reference photoStore", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(
        process.cwd(),
        "src/features/ai-upload/infrastructure/repositories/photo-catalog.repository.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/photoStore/);
    expect(src).toMatch(/fetchProjectPhotosList\s*\(/);
  });
});
