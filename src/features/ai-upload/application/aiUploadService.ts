/**
 * AI-upload slice — Application service.
 *
 * Groups the slice's use cases behind one interface. Handlers and providers
 * depend on this; tests pass fakes.
 */
import { makeAnalyzePhotos, type AnalyzePhotosCommand } from "./analyzePhotos";
import type { RoomAnalysis } from "../domain";
import type { AiVisionPort, PhotoCatalogPort, RoomAnalysisRepository } from "./ports";

export interface AiUploadService {
  analyzePhotos(command: AnalyzePhotosCommand): Promise<RoomAnalysis[]>;
  getCachedAnalyses(projectId: string): RoomAnalysis[] | undefined;
  loadAnalyses(projectId: string): Promise<RoomAnalysis[] | undefined>;
  subscribe(fn: () => void): () => void;
}

export type AiUploadServiceDeps = {
  vision: AiVisionPort;
  analyses: RoomAnalysisRepository;
  photos?: PhotoCatalogPort;
};

export function makeAiUploadService(deps: AiUploadServiceDeps): AiUploadService {
  const analyzePhotos = makeAnalyzePhotos(deps);

  return {
    analyzePhotos,
    getCachedAnalyses: (projectId) => deps.analyses.get(projectId),
    loadAnalyses: (projectId) => deps.analyses.load(projectId),
    subscribe: (fn) => deps.analyses.subscribe(fn),
  };
}
