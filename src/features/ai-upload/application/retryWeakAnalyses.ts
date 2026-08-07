/**
 * Retry only weak/retryable photo analyses and merge into retained good results.
 *
 * Stale mock recovery (P0-PHOTO-ANALYZE):
 * When existing rows are mock and the canonical catalogue has real photos,
 * treat the whole mock set as invalid and re-analyse the current catalogue
 * (do not match against bundled mock URLs).
 */
import {
  analysisPhotoKey,
  assertAnalysisProvenance,
  hasMockAnalysis,
  isRetryableAnalysis,
  mergeAnalysesRetainingGood,
  noSourcePhotosError,
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

    const catalog = await photos.listPhotos(command.projectId);
    if (catalog.length === 0) {
      throw noSourcePhotosError();
    }

    // Mock set + real catalogue → full re-analysis of current project photos.
    if (hasMockAnalysis(existing)) {
      const refreshed = await vision.analyzePhotos({
        projectId: command.projectId,
        photos: catalog,
      });
      assertAnalysisProvenance(catalog, refreshed);
      // Replace only after successful real analysis (no premature delete of old rows).
      await analyses.save(command.projectId, refreshed);
      return refreshed;
    }

    const weak = existing.filter(isRetryableAnalysis);
    if (weak.length === 0) {
      return existing;
    }

    // Prefer durable photo_id; fall back to URL/name for genuine retryable rows.
    const weakKeys = new Set(weak.map(analysisPhotoKey));
    const toRetry = catalog.filter(
      (p) => weakKeys.has(p.id) || weakKeys.has(p.url) || weakKeys.has(p.name),
    );

    if (toRetry.length === 0) {
      // Catalog no longer has matching URLs — return existing without spending quota.
      return existing;
    }

    const refreshed = await vision.analyzePhotos({
      projectId: command.projectId,
      photos: toRetry,
    });

    assertAnalysisProvenance(toRetry, refreshed);

    const merged = mergeAnalysesRetainingGood(existing, refreshed);
    await analyses.save(command.projectId, merged);
    return merged;
  };
}
