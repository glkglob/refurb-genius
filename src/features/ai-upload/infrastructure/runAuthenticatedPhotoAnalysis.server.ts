/**
 * Shared server-only photo analysis orchestration (IOS-READINESS-2C-2).
 *
 * Bearer handler injects the token-authenticated Supabase client.
 * Photos are listed server-side; client photo IDs are ignored.
 * Vision + replace_project_room_analyses run only after ownership is proven.
 */
import "@tanstack/react-start/server-only";

import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit";
import { makeAnalyzePhotos } from "../application/analyzePhotos";
import { makeRetryWeakAnalyses } from "../application/retryWeakAnalyses";
import type { AiVisionPort, PhotoCatalogPort, RoomAnalysisRepository } from "../application/ports";
import { noSourcePhotosError, sourceNotAuthorisedError, type RoomAnalysis } from "../domain";
import {
  listAuthorizedProjectPhotosWithClient,
  type AuthorizedProjectPhoto,
  type PhotoAnalysisAuthClient,
} from "./resolveAuthorizedPhotos.server";
import {
  listProjectRoomAnalysesWithClient,
  replaceProjectRoomAnalysesWithClient,
} from "./repositories/room-analysis.repository.server";

export type RunAuthenticatedPhotoAnalysisInput = {
  userId: string;
  supabase: PhotoAnalysisAuthClient;
  projectId: string;
  mode?: "generate" | "retry-weak";
};

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

async function runVision(input: {
  projectId: string;
  photos: AuthorizedProjectPhoto[];
}): Promise<RoomAnalysis[]> {
  const provider = await getVisionProvider();
  if (provider === "huggingface") {
    const { runSecurePhotoAnalysisHuggingFace } =
      await import("./adapters/hf-vision.adapter.server");
    return runSecurePhotoAnalysisHuggingFace(input);
  }
  const { runSecurePhotoAnalysis } = await import("./adapters/ai-vision.adapter.server");
  return runSecurePhotoAnalysis(input);
}

function makeServerPorts(
  supabase: PhotoAnalysisAuthClient,
  authorized: AuthorizedProjectPhoto[],
): {
  vision: AiVisionPort;
  analyses: RoomAnalysisRepository;
  photos: PhotoCatalogPort;
} {
  const byId = new Map(authorized.map((p) => [p.id, p]));

  return {
    photos: {
      listPhotos: async () => authorized,
    },
    vision: {
      analyzePhotos: async ({ projectId, photos }) => {
        if (photos.length === 0) {
          throw noSourcePhotosError();
        }
        const resolved: AuthorizedProjectPhoto[] = [];
        for (const photo of photos) {
          const auth = byId.get(photo.id);
          if (!auth) {
            throw sourceNotAuthorisedError();
          }
          resolved.push(auth);
        }
        return runVision({ projectId, photos: resolved });
      },
    },
    analyses: {
      get: () => undefined,
      load: async (projectId) => {
        const rows = await listProjectRoomAnalysesWithClient(supabase, projectId);
        return rows.length ? rows : undefined;
      },
      save: async (projectId, analyses) => {
        await replaceProjectRoomAnalysesWithClient(supabase, projectId, analyses);
      },
      subscribe: () => () => undefined,
    },
  };
}

export async function runAuthenticatedPhotoAnalysis(
  input: RunAuthenticatedPhotoAnalysisInput,
): Promise<RoomAnalysis[]> {
  const key = rateLimitKeyForUser(input.userId, "ai-vision");
  const rl = checkRateLimit(key);
  if (!rl.allowed) {
    throw new Error(`Rate limit exceeded. Try again in ${rl.retryAfter || 60}s.`);
  }

  const authorized = await listAuthorizedProjectPhotosWithClient(input.supabase, {
    userId: input.userId,
    projectId: input.projectId,
  });

  if (authorized.length === 0) {
    throw noSourcePhotosError();
  }

  const ports = makeServerPorts(input.supabase, authorized);

  if (input.mode === "retry-weak") {
    const retry = makeRetryWeakAnalyses(ports);
    return retry({ projectId: input.projectId });
  }

  const analyze = makeAnalyzePhotos(ports);
  return analyze({ projectId: input.projectId });
}
