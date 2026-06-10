/**
 * AI-upload slice — AnalyzePhotos use case.
 *
 * Orchestrates vision analysis + persistence. No vendor code, no React —
 * dependencies arrive through ports.
 */
import type { AnalysisPhotoSource, RoomAnalysis } from "../domain";
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
    const photoList = command.photos ?? photos?.listPhotos(command.projectId) ?? [];

    const results = await vision.analyzePhotos({
      projectId: command.projectId,
      photos: photoList,
    });

    await analyses.save(command.projectId, results);
    return results;
  };
}
