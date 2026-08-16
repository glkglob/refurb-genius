import { describe, expect, it } from "vitest";
import {
  isGalleryUnpublishPrivacyComplete,
  PUBLIC_GALLERY_IMAGE_FIELD,
  type PublicGalleryPublication,
} from "./types";

describe("gallery publication contract", () => {
  it("names coverImageUrl as the sole public image field", () => {
    expect(PUBLIC_GALLERY_IMAGE_FIELD).toBe("coverImageUrl");
    const publication: PublicGalleryPublication = {
      id: "gal-1",
      projectId: "proj-1",
      isPublic: true,
      featured: false,
      title: "Listing",
      description: null,
      coverImageUrl: "https://example.com/object/public/gallery/u/p/cover.jpg",
      viewCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(publication).not.toHaveProperty("url");
    expect(publication).not.toHaveProperty("storagePath");
    expect(publication).not.toHaveProperty("storage_path");
    expect(publication).not.toHaveProperty("photos");
  });

  it("treats deleted and already_absent as complete only when listing is hidden", () => {
    expect(
      isGalleryUnpublishPrivacyComplete({
        isPublic: false,
        coverRevocation: { status: "deleted" },
      }),
    ).toBe(true);
    expect(
      isGalleryUnpublishPrivacyComplete({
        isPublic: false,
        coverRevocation: { status: "already_absent" },
      }),
    ).toBe(true);
  });

  it("does not treat delete failure as successful privacy revocation", () => {
    expect(
      isGalleryUnpublishPrivacyComplete({
        isPublic: false,
        coverRevocation: { status: "failed", error: "storage remove denied" },
      }),
    ).toBe(false);
  });

  it("is incomplete while the listing remains public", () => {
    expect(
      isGalleryUnpublishPrivacyComplete({
        isPublic: true,
        coverRevocation: { status: "deleted" },
      }),
    ).toBe(false);
  });
});
