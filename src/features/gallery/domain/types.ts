export interface GalleryOwnerContext {
  userId: string;
  projectId: string;
}

export interface GalleryPublishInput extends GalleryOwnerContext {
  isPublic: boolean;
  title?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
}

export interface GalleryProjectRecord {
  projectId: string;
  isPublic: boolean;
  title: string | null;
  description: string | null;
  coverImageUrl: string | null;
}
