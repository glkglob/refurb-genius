/**
 * Gallery domain — project-level publication, cover-only public imagery.
 *
 * Canonical listing columns (public_gallery_projects):
 *   id, project_id, is_public, featured, title, description,
 *   cover_image_url, view_count, created_at, updated_at
 *
 * Public gallery imagery is the optional cover only.
 * Project photos (photos.url / photos.storage_path) are private originals
 * and are not publication assets.
 */

export interface GalleryOwnerContext {
  userId: string;
  projectId: string;
}

export interface GalleryPublishInput extends GalleryOwnerContext {
  isPublic: boolean;
  title?: string | null;
  description?: string | null;
  /** Sole public gallery image. Never a project-photo URL. */
  coverImageUrl?: string | null;
}

export interface GalleryProjectRecord {
  projectId: string;
  isPublic: boolean;
  title: string | null;
  description: string | null;
  /** Sole public gallery image. Null means a listing without a cover. */
  coverImageUrl: string | null;
}

/**
 * Public listing contract. Imagery is `coverImageUrl` only — no photo collection.
 */
export interface PublicGalleryPublication {
  id: string;
  projectId: string;
  isPublic: boolean;
  featured: boolean;
  title: string | null;
  description: string | null;
  coverImageUrl: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export const PUBLIC_GALLERY_IMAGE_FIELD = "coverImageUrl" as const;

/**
 * Cover-object revocation outcomes for GALLERY-C.
 * `failed` is never success — privacy cleanup is incomplete.
 */
export type GalleryCoverRevocationStatus = "deleted" | "already_absent" | "failed";

export type GalleryCoverRevocationResult =
  | { status: "deleted" }
  | { status: "already_absent" }
  | { status: "failed"; error: string };

/**
 * Unpublish privacy is complete only when the listing is non-public and
 * cover revocation succeeded or the object was already absent.
 */
export function isGalleryUnpublishPrivacyComplete(input: {
  isPublic: boolean;
  coverRevocation: GalleryCoverRevocationResult;
}): boolean {
  if (input.isPublic) return false;
  return (
    input.coverRevocation.status === "deleted" || input.coverRevocation.status === "already_absent"
  );
}
