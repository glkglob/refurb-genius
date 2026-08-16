/**
 * SEC-1B-GALLERY-C — gallery cover revocation and path validation.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isGalleryUnpublishPrivacyComplete } from "@/features/gallery/domain";
import { galleryPathFromPublicUrl } from "@/lib/gallery";

const removeMock = vi.hoisted(() => vi.fn());
const loggerError = vi.hoisted(() => vi.fn());
const CANONICAL_ORIGIN = "https://gallery.test.example";

vi.mock("@/platform/supabase/browser", () => ({
  resolveSupabaseEnv: () => ({
    supabaseUrl: CANONICAL_ORIGIN,
    supabaseAnonKey: "test-anon",
    isConfigured: true,
  }),
  supabase: {
    storage: {
      from: (bucket: string) => {
        if (bucket !== "gallery") {
          throw new Error(`unexpected bucket ${bucket}`);
        }
        return { remove: removeMock };
      },
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => loggerError(...args),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { createGalleryCoverLifecycle, revokeGalleryCover } from "./galleryCoverLifecycle";

const GALLERY_URL = `${CANONICAL_ORIGIN}/storage/v1/object/public/gallery/user-1/proj-1/cover.jpg`;

describe("galleryPathFromPublicUrl", () => {
  it("extracts the object path from a configured-origin gallery public URL", () => {
    expect(galleryPathFromPublicUrl(GALLERY_URL)).toBe("user-1/proj-1/cover.jpg");
  });

  it("ignores query strings and fragments on a valid URL", () => {
    expect(galleryPathFromPublicUrl(`${GALLERY_URL}?download=1#top`)).toBe(
      "user-1/proj-1/cover.jpg",
    );
  });

  it("decodes a valid encoded filename", () => {
    expect(
      galleryPathFromPublicUrl(
        `${CANONICAL_ORIGIN}/storage/v1/object/public/gallery/user-1/proj-1/a%20b.jpg`,
      ),
    ).toBe("user-1/proj-1/a b.jpg");
  });

  it("rejects empty, malformed, foreign-bucket, and unrelated URLs", () => {
    expect(galleryPathFromPublicUrl(null)).toBeNull();
    expect(galleryPathFromPublicUrl("")).toBeNull();
    expect(galleryPathFromPublicUrl("   ")).toBeNull();
    expect(galleryPathFromPublicUrl("not-a-url")).toBeNull();
    expect(
      galleryPathFromPublicUrl(
        `${CANONICAL_ORIGIN}/storage/v1/object/public/project-photos/user-1/proj-1/a.jpg`,
      ),
    ).toBeNull();
    expect(
      galleryPathFromPublicUrl(
        `${CANONICAL_ORIGIN}/storage/v1/object/public/floorplans/user-1/proj-1/a.jpg`,
      ),
    ).toBeNull();
    expect(galleryPathFromPublicUrl("https://evil.example/gallery/user-1/proj-1/a.jpg")).toBeNull();
  });

  it("rejects a foreign host that mimics the gallery storage pathname", () => {
    expect(
      galleryPathFromPublicUrl(
        "https://evil.example/storage/v1/object/public/gallery/user-1/proj-1/cover.jpg",
      ),
    ).toBeNull();
    expect(
      galleryPathFromPublicUrl(
        "https://attacker.test/cdn/object/public/gallery/user-1/proj-1/cover.jpg",
      ),
    ).toBeNull();
  });

  it("rejects another Supabase project origin", () => {
    expect(
      galleryPathFromPublicUrl(
        "https://abcdefghijklmnop.supabase.co/storage/v1/object/public/gallery/user-1/proj-1/cover.jpg",
      ),
    ).toBeNull();
  });

  it("rejects userinfo, non-http schemes, and contain-not-prefix paths", () => {
    expect(
      galleryPathFromPublicUrl(
        `https://evil@gallery.test.example/storage/v1/object/public/gallery/user-1/proj-1/cover.jpg`,
      ),
    ).toBeNull();
    expect(
      galleryPathFromPublicUrl(
        `ftp://gallery.test.example/storage/v1/object/public/gallery/user-1/proj-1/cover.jpg`,
      ),
    ).toBeNull();
    expect(
      galleryPathFromPublicUrl(
        `${CANONICAL_ORIGIN}/cdn/object/public/gallery/user-1/proj-1/cover.jpg`,
      ),
    ).toBeNull();
  });

  it("rejects path traversal and encoded parent segments", () => {
    expect(
      galleryPathFromPublicUrl(
        `${CANONICAL_ORIGIN}/storage/v1/object/public/gallery/user-1/../secret.jpg`,
      ),
    ).toBeNull();
    expect(
      galleryPathFromPublicUrl(
        `${CANONICAL_ORIGIN}/storage/v1/object/public/gallery/%2e%2e/secret.jpg`,
      ),
    ).toBeNull();
    expect(
      galleryPathFromPublicUrl(`${CANONICAL_ORIGIN}/storage/v1/object/public/gallery/onlyone`),
    ).toBeNull();
  });
});

describe("revokeGalleryCover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeMock.mockResolvedValue({ data: [], error: null });
  });

  it("returns already_absent when no cover URL is present", async () => {
    await expect(revokeGalleryCover({ coverImageUrl: null })).resolves.toEqual({
      status: "already_absent",
    });
    await expect(revokeGalleryCover({ coverImageUrl: "  " })).resolves.toEqual({
      status: "already_absent",
    });
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("deletes a gallery object and returns deleted", async () => {
    await expect(revokeGalleryCover({ coverImageUrl: GALLERY_URL })).resolves.toEqual({
      status: "deleted",
    });
    expect(removeMock).toHaveBeenCalledWith(["user-1/proj-1/cover.jpg"]);
  });

  it("classifies installed-client idempotent remove as deleted", async () => {
    removeMock.mockResolvedValue({ data: [], error: null });
    await expect(revokeGalleryCover({ coverImageUrl: GALLERY_URL })).resolves.toEqual({
      status: "deleted",
    });
  });

  it("returns failed for storage errors", async () => {
    removeMock.mockResolvedValue({
      data: null,
      error: { message: "storage remove denied", statusCode: "403" },
    });
    await expect(revokeGalleryCover({ coverImageUrl: GALLERY_URL })).resolves.toEqual({
      status: "failed",
      error: "storage remove denied",
    });
  });

  it("returns failed when storage remove throws", async () => {
    removeMock.mockRejectedValue(new Error("network down"));
    await expect(revokeGalleryCover({ coverImageUrl: GALLERY_URL })).resolves.toEqual({
      status: "failed",
      error: "network down",
    });
    expect(
      isGalleryUnpublishPrivacyComplete({
        isPublic: false,
        coverRevocation: { status: "failed", error: "network down" },
      }),
    ).toBe(false);
  });

  it("does not delete an arbitrary, foreign-host, or project-photos URL", async () => {
    const foreign = `${CANONICAL_ORIGIN}/storage/v1/object/public/project-photos/user-1/proj-1/a.jpg`;
    const mimic = "https://evil.example/storage/v1/object/public/gallery/user-1/proj-1/cover.jpg";
    await expect(revokeGalleryCover({ coverImageUrl: foreign })).resolves.toEqual({
      status: "failed",
      error: "Cover URL is not a gallery object",
    });
    await expect(revokeGalleryCover({ coverImageUrl: mimic })).resolves.toEqual({
      status: "failed",
      error: "Cover URL is not a gallery object",
    });
    await expect(revokeGalleryCover({ coverImageUrl: "https://evil.example/x" })).resolves.toEqual({
      status: "failed",
      error: "Cover URL is not a gallery object",
    });
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("never treats failed revocation as privacy complete", async () => {
    const failed = await revokeGalleryCover({
      coverImageUrl: "https://evil.example/not-gallery",
    });
    expect(
      isGalleryUnpublishPrivacyComplete({
        isPublic: false,
        coverRevocation: failed,
      }),
    ).toBe(false);
  });

  it("createGalleryCoverLifecycle delegates to revokeGalleryCover", async () => {
    const lifecycle = createGalleryCoverLifecycle();
    await expect(lifecycle.revokeCover({ coverImageUrl: null })).resolves.toEqual({
      status: "already_absent",
    });
  });

  it("does not use privileged signing or project-photo storage", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "galleryCoverLifecycle.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/service_role/);
    expect(source).not.toMatch(/createSignedUrl/);
    expect(source).not.toMatch(/project-photos/);
    expect(source).not.toMatch(/from\(\s*["']photos["']\s*\)/);
    expect(source).toMatch(/GALLERY_BUCKET/);
  });
});
