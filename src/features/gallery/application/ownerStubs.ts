import type { GalleryOwnerContext } from "@/features/gallery/domain";
import type { GalleryRepository } from "./ports";

export async function assertGalleryOwner(
  repository: GalleryRepository,
  input: GalleryOwnerContext,
): Promise<void> {
  await repository.assertOwner(input);
}
