/**
 * AI-upload slice — Client-side photo analysis provider (presentation wiring).
 *
 * Moved from `src/core/ai/photoAnalysis.ts` (now a shim).
 * Web talks to the cookie serverFn via analyzePhotosForClient.
 * Native uses Bearer /api/mobile/v1/analysis/run. OpenAI stays server-side.
 */
import { makeAiUploadService } from "../application";
import type { RoomAnalysis } from "../domain";
import { supabaseRoomAnalysisRepository } from "../infrastructure/repositories/room-analysis.repository";
import { browserPhotoCatalogRepository } from "../infrastructure/repositories/photo-catalog.repository";
import { analyzePhotosForClient } from "./analyzePhotosForClient";

export type PhotoAnalysisInput = {
  projectId: string;
  region?: string;
  propertyType?: string;
};

export type PhotoAnalysisProvider = {
  get(projectId: string): RoomAnalysis[] | undefined;
  run(input: PhotoAnalysisInput): Promise<RoomAnalysis[]>;
  subscribe(fn: () => void): () => void;
};

const serverVisionAdapter = {
  async analyzePhotos(input: {
    projectId: string;
    photos: import("../domain").AnalysisPhotoSource[];
  }): Promise<RoomAnalysis[]> {
    return analyzePhotosForClient({
      projectId: input.projectId,
      photoIds: input.photos.map((photo) => photo.id),
    });
  },
};

const aiUploadService = makeAiUploadService({
  vision: serverVisionAdapter,
  analyses: supabaseRoomAnalysisRepository,
  photos: browserPhotoCatalogRepository,
});

/** Default mock provider — wraps the in-memory repository mock run. */
export const mockPhotoAnalysisProvider: PhotoAnalysisProvider = {
  get(projectId) {
    return supabaseRoomAnalysisRepository.get(projectId);
  },
  async run({ projectId }) {
    return supabaseRoomAnalysisRepository.runMock(projectId);
  },
  subscribe(fn) {
    return supabaseRoomAnalysisRepository.subscribe(fn);
  },
};

export const serverPhotoAnalysisProvider: PhotoAnalysisProvider = {
  get(projectId) {
    return aiUploadService.getCachedAnalyses(projectId);
  },
  async run(input) {
    return aiUploadService.analyzePhotos({ projectId: input.projectId });
  },
  subscribe(fn) {
    return aiUploadService.subscribe(fn);
  },
};

export const photoAnalysisProvider: PhotoAnalysisProvider = serverPhotoAnalysisProvider;

export function getPhotoAnalysis(projectId: string): RoomAnalysis[] | undefined {
  return photoAnalysisProvider.get(projectId);
}

export async function loadPhotoAnalysis(projectId: string): Promise<RoomAnalysis[] | undefined> {
  return aiUploadService.loadAnalyses(projectId);
}

export function runPhotoAnalysis(input: PhotoAnalysisInput): Promise<RoomAnalysis[]> {
  return photoAnalysisProvider.run(input);
}

export function subscribePhotoAnalysis(fn: () => void): () => void {
  return photoAnalysisProvider.subscribe(fn);
}
