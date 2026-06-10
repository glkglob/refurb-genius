import type {
  GalleryOwnerContext,
  GalleryProjectRecord,
  GalleryPublishInput,
} from "@/features/gallery/domain";

export interface GalleryRepository {
  assertOwner(input: GalleryOwnerContext): Promise<void>;
  upsertPublication(input: GalleryPublishInput): Promise<GalleryProjectRecord>;
}
