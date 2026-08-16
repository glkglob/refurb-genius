import type {
  GalleryCoverRevocationResult,
  GalleryOwnerContext,
  GalleryProjectRecord,
  GalleryPublishInput,
  PublicGalleryPublication,
} from "@/features/gallery/domain";

/**
 * Cover-object lifecycle for GALLERY-C.
 *
 * Unpublish, cover replace, gallery delete, and project delete must revoke
 * known public cover objects. This port has no runtime side effects in GALLERY-B.
 *
 * Outcomes must stay distinct:
 * - deleted
 * - already_absent (idempotent success)
 * - failed (privacy cleanup incomplete; never report as success)
 */
export interface GalleryCoverLifecycle {
  revokeCover(input: { coverImageUrl: string | null }): Promise<GalleryCoverRevocationResult>;
}

/**
 * Listing persistence and public read contract.
 *
 * A public gallery record is listing metadata plus optional coverImageUrl.
 * Implementations must not join or retrieve project photos.
 */
export interface GalleryRepository {
  assertOwner(input: GalleryOwnerContext): Promise<void>;
  upsertPublication(input: GalleryPublishInput): Promise<GalleryProjectRecord>;
  listPublicPublications(): Promise<PublicGalleryPublication[]>;
  getPublicPublicationById(id: string): Promise<PublicGalleryPublication | null>;
}
