/**
 * AO-1M3 / P1B4 — galleryRepository.upsertGalleryProject table contract.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

import { upsertGalleryProject, toPublicGalleryPublication } from "./galleryRepository";
import { createGalleryCoverLifecycle, createGalleryRepository } from "./index";

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

  it("maps listing rows to cover-only public publication identity", () => {
    const publication = toPublicGalleryPublication(serverRow);
    expect(publication).toEqual({
      id: "gal-1",
      projectId: PROJECT,
      isPublic: true,
      featured: true,
      title: "Victorian Terrace",
      description: "Full refurb",
      coverImageUrl: "https://example.com/cover.jpg",
      viewCount: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(publication).not.toHaveProperty("url");
    expect(publication).not.toHaveProperty("storage_path");
    expect(publication).not.toHaveProperty("storagePath");
    expect(publication).not.toHaveProperty("photos");
  });

  it("does not query the photos table or require photo retrieval fields", async () => {
    await upsertGalleryProject({
      projectId: PROJECT,
      userId: USER,
      is_public: true,
      cover_image_url: "https://example.com/cover.jpg",
    });

    expect(fromMock).toHaveBeenCalledWith("public_gallery_projects");
    expect(fromMock).not.toHaveBeenCalledWith("photos");

    const payload = upsertMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("url");
    expect(payload).not.toHaveProperty("storage_path");
    expect(payload).not.toHaveProperty("photo_ids");
  });

  it("publication remains project-level (onConflict project_id)", async () => {
    await upsertGalleryProject({
      projectId: PROJECT,
      userId: USER,
      is_public: true,
    });
    expect(upsertMock).toHaveBeenCalledWith(expect.any(Object), { onConflict: "project_id" });
  });
});

describe("gallery repository security contract", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "galleryRepository.ts"),
    "utf8",
  );

  it("does not introduce a privileged signer or storage client", () => {
    expect(source).not.toMatch(/service_role/);
    expect(source).not.toMatch(/createSignedUrl/);
    expect(source).not.toMatch(/storage\.from/);
    expect(source).not.toMatch(/from\(\s*["']photos["']\s*\)/);
    expect(source).not.toMatch(/project-photos/);
  });
});

describe("gallery port scaffolds", () => {
  it("does not perform public photo reads; cover revoke is already_absent without a URL", async () => {
    const repository = createGalleryRepository();
    const lifecycle = createGalleryCoverLifecycle();

    await expect(repository.listPublicPublications()).rejects.toThrow(/not implemented/);
    await expect(repository.getPublicPublicationById("gal-1")).rejects.toThrow(/not implemented/);
    await expect(lifecycle.revokeCover({ coverImageUrl: null })).resolves.toEqual({
      status: "already_absent",
    });
  });
});
