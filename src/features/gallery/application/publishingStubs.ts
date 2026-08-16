import type { GalleryProjectRecord, GalleryPublishInput } from "@/features/gallery/domain";
import type { GalleryRepository } from "./ports";

/**
 * Listing-visibility stubs. Not on the live publish path (PublishToGallery
 * uses useUpsertGalleryProject). Do not wire these into routes/hooks here.
 *
 * They flip `isPublic` only. They do not publish project photos and they
 * do not revoke cover objects. Cover revocation is GalleryCoverLifecycle
 * (GALLERY-C).
 */
export const GALLERY_STUB_UNPUBLISH_REVOKES_COVER = false;

export async function publishGalleryProject(
  repository: GalleryRepository,
  input: GalleryPublishInput,
): Promise<GalleryProjectRecord> {
  await repository.assertOwner(input);
  return repository.upsertPublication({ ...input, isPublic: true });
}

export async function unpublishGalleryProject(
  repository: GalleryRepository,
  input: GalleryPublishInput,
): Promise<GalleryProjectRecord> {
  await repository.assertOwner(input);
  return repository.upsertPublication({ ...input, isPublic: false });
}
