import type { GalleryProjectRecord, GalleryPublishInput } from "@/features/gallery/domain";
import type { GalleryRepository } from "./ports";

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
