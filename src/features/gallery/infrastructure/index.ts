import type { GalleryRepository } from "@/features/gallery/application";

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
