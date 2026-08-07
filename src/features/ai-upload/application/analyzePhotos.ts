/**
 * AI-upload slice — AnalyzePhotos use case.
 *
 * Orchestrates vision analysis + persistence. No vendor code, no React —
 * dependencies arrive through ports.
 *
 * Production contract (P0-PHOTO-ANALYZE):
 * - require >= 1 canonical project photo;
 * - never call vision with an empty photo list;
 * - never persist mock results as production analysis;
 * - result cardinality/provenance must match supplied photos.
 */
import {
  assertAnalysisProvenance,
  noSourcePhotosError,
  type AnalysisPhotoSource,
  type RoomAnalysis,
} from "../domain";
import type { AiVisionPort, PhotoCatalogPort, RoomAnalysisRepository } from "./ports";

export type AnalyzePhotosCommand = {
  projectId: string;
  /** When omitted, photos are resolved from the catalog port. */
  photos?: AnalysisPhotoSource[];
};

export type AnalyzePhotosDeps = {
  vision: AiVisionPort;
  analyses: RoomAnalysisRepository;
  photos?: PhotoCatalogPort;
};

export function makeAnalyzePhotos({ vision, analyses, photos }: AnalyzePhotosDeps) {
  return async function analyzePhotos(command: AnalyzePhotosCommand): Promise<RoomAnalysis[]> {
    // Explicit photos override the catalog. Catalog is async (C5-2 / fetchProjectPhotosList).
    const photoList = command.photos ?? (photos ? await photos.listPhotos(command.projectId) : []);

    if (photoList.length === 0) {
      throw noSourcePhotosError();
    }

    const results = await vision.analyzePhotos({
      projectId: command.projectId,
      photos: photoList,
    });

    // Reject mock rows, cardinality drift, and unlinked results before any persistence.
    assertAnalysisProvenance(photoList, results);

    // Persist only after successful grounded analysis. Repository must not
    // destroy prior rows before the new insert succeeds.
    await analyses.save(command.projectId, results);
    return results;
  };
}
