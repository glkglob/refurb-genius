/**
 * Retry only weak/retryable photo analyses and merge into retained good results.
 */
import {
  analysisPhotoKey,
  isRetryableAnalysis,
  mergeAnalysesRetainingGood,
  type RoomAnalysis,
} from "../domain";
import type { AiVisionPort, PhotoCatalogPort, RoomAnalysisRepository } from "./ports";

export type RetryWeakAnalysesCommand = {
  projectId: string;
};

export type RetryWeakAnalysesDeps = {
  vision: AiVisionPort;
  analyses: RoomAnalysisRepository;
  photos: PhotoCatalogPort;
};

export function makeRetryWeakAnalyses({ vision, analyses, photos }: RetryWeakAnalysesDeps) {
  return async function retryWeakAnalyses(
    command: RetryWeakAnalysesCommand,
  ): Promise<RoomAnalysis[]> {
    const existing =
      (await analyses.load(command.projectId)) ?? analyses.get(command.projectId) ?? [];

    const weak = existing.filter(isRetryableAnalysis);
    if (weak.length === 0) {
      return existing;
    }

    const weakKeys = new Set(weak.map(analysisPhotoKey));
    const catalog = await photos.listPhotos(command.projectId);
    const toRetry = catalog.filter((p) => weakKeys.has(p.url));

    if (toRetry.length === 0) {
      // Catalog no longer has matching URLs — return existing without spending quota.
      return existing;
    }

    const refreshed = await vision.analyzePhotos({
      projectId: command.projectId,
      photos: toRetry,
    });

    const merged = mergeAnalysesRetainingGood(existing, refreshed);
    await analyses.save(command.projectId, merged);
    return merged;
  };
}
