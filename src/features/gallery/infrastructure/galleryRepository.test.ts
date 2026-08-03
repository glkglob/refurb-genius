/**
 * AO-1M3 / P1B4 — galleryRepository.upsertGalleryProject table contract.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock, upsertMock, selectMock, singleMock, loggerError } = vi.hoisted(() => {
  const singleMock = vi.fn();
  const selectMock = vi.fn(() => ({ single: singleMock }));
  const upsertMock = vi.fn((..._args: unknown[]) => ({ select: selectMock }));
  const fromMock = vi.fn(() => ({ upsert: upsertMock }));
  return {
    fromMock,
    upsertMock,
    selectMock,
    singleMock,
    loggerError: vi.fn(),
  };
});

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => loggerError(...args),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { upsertGalleryProject } from "./galleryRepository";

const PROJECT = "proj-gallery-1";
const USER = "user-gallery-1";

const serverRow = {
  id: "gal-1",
  project_id: PROJECT,
  is_public: true,
  featured: true,
  title: "Victorian Terrace",
  description: "Full refurb",
  cover_image_url: "https://example.com/cover.jpg",
  view_count: 3,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

const OBSOLETE = [
  "created_by",
  "slug",
  "is_published",
  "summary",
  "location",
  "style",
  "budget",
  "roi",
  "published_at",
];

describe("upsertGalleryProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertMock.mockImplementation(() => ({ select: selectMock }));
    selectMock.mockImplementation(() => ({ single: singleMock }));
    singleMock.mockResolvedValue({ data: serverRow, error: null });
  });

  it("uses public_gallery_projects with upsert onConflict project_id", async () => {
    await upsertGalleryProject({
      projectId: PROJECT,
      userId: USER,
      is_public: true,
      featured: true,
      title: "Victorian Terrace",
      description: "Full refurb",
      cover_image_url: "https://example.com/cover.jpg",
    });

    expect(fromMock).toHaveBeenCalledWith("public_gallery_projects");
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(expect.any(Object), { onConflict: "project_id" });
    expect(selectMock).toHaveBeenCalledWith("*");
    expect(singleMock).toHaveBeenCalled();
  });

  it("writes canonical payload only (no created_by/slug/obsolete fields)", async () => {
    await upsertGalleryProject({
      projectId: PROJECT,
      userId: USER,
      is_public: false,
      featured: true,
      title: null,
      description: null,
      cover_image_url: null,
    });

    const payload = upsertMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload).toEqual({
      project_id: PROJECT,
      is_public: false,
      featured: true,
      title: "Untitled Project",
      description: null,
      cover_image_url: null,
    });
    for (const key of OBSOLETE) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  it("preserves non-null title when supplied", async () => {
    await upsertGalleryProject({
      projectId: PROJECT,
      userId: USER,
      title: "Custom Title",
    });

    const payload = upsertMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.title).toBe("Custom Title");
  });

  it("returns mapped application row", async () => {
    const result = await upsertGalleryProject({
      projectId: PROJECT,
      userId: USER,
      is_public: true,
    });
    expect(result).toMatchObject({
      id: "gal-1",
      project_id: PROJECT,
      is_public: true,
      title: "Victorian Terrace",
      view_count: 3,
    });
    expect(result).not.toHaveProperty("created_by");
    expect(result).not.toHaveProperty("slug");
  });

  it("logs and throws Error(error.message) on Supabase failure", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { message: "RLS denied" },
    });

    await expect(
      upsertGalleryProject({
        projectId: PROJECT,
        userId: USER,
        is_public: true,
      }),
    ).rejects.toThrow("RLS denied");

    expect(loggerError).toHaveBeenCalledWith(
      "[gallery] upsert failed",
      expect.objectContaining({ projectId: PROJECT, error: "RLS denied" }),
    );
  });
});
