/**
 * AI-upload slice — Application ports.
 *
 * Every IO concern the use cases need is expressed as an interface here.
 * Implementations live in `../infrastructure`; tests pass fakes.
 */
import type { AnalysisPhotoSource, RoomAnalysis } from "../domain";

export interface RoomAnalysisRepository {
  get(projectId: string): RoomAnalysis[] | undefined;
  load(projectId: string): Promise<RoomAnalysis[] | undefined>;
  save(projectId: string, analyses: RoomAnalysis[]): Promise<void>;
  subscribe(fn: () => void): () => void;
}

export interface PhotoCatalogPort {
  listPhotos(projectId: string): AnalysisPhotoSource[];
}

export interface AiVisionPort {
  analyzePhotos(input: {
    projectId: string;
    photos: AnalysisPhotoSource[];
  }): Promise<RoomAnalysis[]>;
}
