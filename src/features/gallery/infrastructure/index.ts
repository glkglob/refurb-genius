import type { GalleryRepository } from "@/features/gallery/application";

export {
  galleryRepository,
  upsertGalleryProject,
  toPublicGalleryPublication,
  type UpsertGalleryProjectRecordInput,
} from "./galleryRepository";

export { createGalleryCoverLifecycle, revokeGalleryCover } from "./galleryCoverLifecycle";

const NOT_IMPLEMENTED = {
  owner: "Gallery owner verification is not implemented yet.",
  publish: "Gallery publishing is not implemented yet.",
  list: "Public gallery listing read is not implemented yet.",
  byId: "Public gallery detail read is not implemented yet.",
} as const;

/**
 * Scaffold GalleryRepository port implementation.
 * Owner-management upsert used by presentation is {@link galleryRepository}.
 * Public reads remain in src/lib/queries/gallery.ts until GALLERY-D.
 */
export function createGalleryRepository(): GalleryRepository {
  return {
    assertOwner: async () => {
      throw new Error(NOT_IMPLEMENTED.owner);
    },
    upsertPublication: async () => {
      throw new Error(NOT_IMPLEMENTED.publish);
    },
    listPublicPublications: async () => {
      throw new Error(NOT_IMPLEMENTED.list);
    },
    getPublicPublicationById: async () => {
      throw new Error(NOT_IMPLEMENTED.byId);
    },
  };
}
