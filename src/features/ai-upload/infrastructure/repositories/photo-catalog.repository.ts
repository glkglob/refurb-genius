/**
 * AI-upload slice — Photo catalog (browser context).
 *
 * Lists uploaded photos for a project. Upload/remove logic remains in
 * `src/lib/photos` until a later pass; this port only reads the catalog.
 */
import { photoStore } from "@/lib/photos";
import type { AnalysisPhotoSource } from "../../domain";
import type { PhotoCatalogPort } from "../../application/ports";

export class BrowserPhotoCatalogRepository implements PhotoCatalogPort {
  listPhotos(projectId: string): AnalysisPhotoSource[] {
    return photoStore.list(projectId).map(({ id, url, name, size }) => ({
      id,
      url,
      name,
      size,
    }));
  }
}

export const browserPhotoCatalogRepository = new BrowserPhotoCatalogRepository();
