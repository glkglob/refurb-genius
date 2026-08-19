/**
 * Shared authenticated Photo Analysis runner.
 *
 * Web cookie serverFn and native Bearer handler both delegate here.
 * One logical Analysis = one ai-vision rate-limit event, then:
 *   resolve canonical catalogue (no retrievalUrl)
 *   → ceiling
 *   → sequential JIT-signed provider batches
 *   → complete runtime + provenance validation
 */
import "@tanstack/react-start/server-only";

import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit";
import {
  assertAnalysisProvenance,
  assertProductionRoomAnalysisList,
  catalogueTooLargeError,
  duplicatePhotoIdsError,
  noSourcePhotosError,
  PhotoAnalysisError,
  PHOTO_ANALYSIS_CARDINALITY_MISMATCH,
  providerUnavailableError,
  type RoomAnalysis,
} from "../domain";
import {
  resolveCanonicalAuthorizedPhotos,
  signAuthorizedPhotoBatch,
  type CanonicalAuthorizedPhoto,
  type PhotoAnalysisAuthClient,
} from "./resolveAuthorizedPhotos.server";

/** Analysis-specific synchronous catalogue ceiling. Not an upload or project-storage limit. */
export const MAX_ANALYSIS_PHOTOS = 30;

/** Provider batch size. Independent of the upload batch constant. */
export const MAX_PHOTOS_PER_VISION_BATCH = 10;

export type VisionCatalogueMode = "exact" | "requested";

export type RunAuthenticatedPhotoAnalysisInput = {
  userId: string;
  supabase: PhotoAnalysisAuthClient;
  projectId: string;
  photoIds: string[];
  catalogueMode: VisionCatalogueMode;
  provider?: "openai" | "huggingface";
};

export function chunkCanonicalPhotosForVision<T>(photos: readonly T[]): T[][] {
  if (photos.length > MAX_ANALYSIS_PHOTOS) {
    throw catalogueTooLargeError();
  }
  const batches: T[][] = [];
  for (let i = 0; i < photos.length; i += MAX_PHOTOS_PER_VISION_BATCH) {
    batches.push(photos.slice(i, i + MAX_PHOTOS_PER_VISION_BATCH));
  }
  return batches;
}

async function getVisionProvider(): Promise<"openai" | "huggingface"> {
  const explicit = process.env.AI_VISION_PROVIDER;
  if (explicit === "openai" || explicit === "huggingface") return explicit;

  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const { isHuggingFaceConfigured } = await import("@/platform/huggingface/server");
  const hasHF = isHuggingFaceConfigured();

  if (hasOpenAI) return "openai";
  if (hasHF) return "huggingface";
  return "openai";
}

function assertNoDuplicateIds(photoIds: string[]): void {
  if (new Set(photoIds).size !== photoIds.length) {
    throw duplicatePhotoIdsError();
  }
}

function mapProviderFailure(err: unknown): never {
  const message = err instanceof Error ? err.message : "";
  if (
    /OPENAI_API_KEY/i.test(message) ||
    /HUGGINGFACE_API_KEY/i.test(message) ||
    /HUGGINGFACE_ENDPOINT_URL/i.test(message) ||
    /is not configured/i.test(message)
  ) {
    throw providerUnavailableError();
  }
  throw err;
}

async function runVisionBatch(input: {
  projectId: string;
  photos: CanonicalAuthorizedPhoto[];
  provider: "openai" | "huggingface";
}): Promise<RoomAnalysis[]> {
  const payload = { projectId: input.projectId, photos: input.photos };
  try {
    if (input.provider === "huggingface") {
      const { runSecurePhotoAnalysisHuggingFace } =
        await import("./adapters/hf-vision.adapter.server");
      return await runSecurePhotoAnalysisHuggingFace(payload);
    }
    const { runSecurePhotoAnalysis } = await import("./adapters/ai-vision.adapter.server");
    return await runSecurePhotoAnalysis(payload);
  } catch (err) {
    mapProviderFailure(err);
  }
}

export async function runAuthenticatedPhotoAnalysis(
  input: RunAuthenticatedPhotoAnalysisInput,
): Promise<RoomAnalysis[]> {
  if (!input.photoIds.length) {
    throw noSourcePhotosError();
  }
  assertNoDuplicateIds(input.photoIds);

  const key = rateLimitKeyForUser(input.userId, "ai-vision");
  const rl = checkRateLimit(key);
  if (!rl.allowed) {
    throw new Error(`Rate limit exceeded. Try again in ${rl.retryAfter || 60}s.`);
  }

  const canonical = await resolveCanonicalAuthorizedPhotos({
    userId: input.userId,
    projectId: input.projectId,
    photoIds: input.photoIds,
    supabase: input.supabase,
    catalogueMode: input.catalogueMode,
  });

  if (canonical.length > MAX_ANALYSIS_PHOTOS) {
    throw catalogueTooLargeError();
  }

  const batches = chunkCanonicalPhotosForVision(canonical);
  const provider = input.provider ?? (await getVisionProvider());
  const combined: RoomAnalysis[] = [];

  for (const batch of batches) {
    const signed = await signAuthorizedPhotoBatch(input.supabase, batch);
    let batchResults: RoomAnalysis[];
    try {
      batchResults = await runVisionBatch({
        projectId: input.projectId,
        photos: signed.map((photo) => ({ ...photo })),
        provider,
      });
    } finally {
      for (const photo of signed) {
        (photo as { retrievalUrl?: string }).retrievalUrl = undefined;
      }
      signed.length = 0;
    }

    if (!Array.isArray(batchResults) || batchResults.length !== batch.length) {
      throw new PhotoAnalysisError(
        PHOTO_ANALYSIS_CARDINALITY_MISMATCH,
        `Expected ${batch.length} analyses for ${batch.length} photos, received ${
          Array.isArray(batchResults) ? batchResults.length : 0
        }.`,
      );
    }
    combined.push(...batchResults);
  }

  const validated = assertProductionRoomAnalysisList(combined);
  assertAnalysisProvenance(canonical, validated);
  return validated;
}
