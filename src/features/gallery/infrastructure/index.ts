import type { GalleryRepository } from "@/features/gallery/application";

export {
  galleryRepository,
  upsertGalleryProject,
  type UpsertGalleryProjectRecordInput,
} from "./galleryRepository";

/**
 * Scaffold GalleryRepository port implementation.
 * Owner-management upsert used by presentation is {@link galleryRepository}.
 */
export function createGalleryRepository(): GalleryRepository {
  return {
    assertOwner: async () => {
      throw new Error("Gallery owner verification is not implemented yet.");
    },
    upsertPublication: async () => {
      throw new Error("Gallery publishing is not implemented yet.");
    },
  };
}
