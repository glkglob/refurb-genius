/**
 * AI-upload slice — Photo catalog (browser context).
 *
 * Lists uploaded photos for a project via the C5-1 canonical list fetch.
 * Upload/remove logic remains in `src/lib/photos` until a later pass; this
 * port only reads the catalog (C5-2).
 */
import { fetchProjectPhotosList } from "@/lib/queries/projects";
import type { AnalysisPhotoSource } from "../../domain";
import type { PhotoCatalogPort } from "../../application/ports";

export class BrowserPhotoCatalogRepository implements PhotoCatalogPort {
  async listPhotos(projectId: string): Promise<AnalysisPhotoSource[]> {
    const photos = await fetchProjectPhotosList(projectId);
    return photos.map(({ id, url, name, size }) => ({
      id,
      url,
      name,
      size,
    }));
  }
}

export const browserPhotoCatalogRepository = new BrowserPhotoCatalogRepository();
