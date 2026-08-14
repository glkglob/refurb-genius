/**
 * Shared server-only redesign generation orchestration (IOS-2C3-I).
 *
 * Web cookie serverFn and mobile Bearer endpoint inject an authenticated
 * Supabase client. Identity is never taken from a client-supplied userId for
 * RPC/RLS — callers pass token/cookie-derived userId only for rate limiting
 * and call-site clarity. Durable Analysis is re-read server-side.
 */
import "@tanstack/react-start/server-only";

import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit";
import {
  analysisIdentityFromPhotoIds,
  type DurableRedesignConcept,
} from "../domain/redesignAuthority";
import type { RedesignStyle } from "../domain";
import { resolveCurrentProjectAnalysisAuthorityWithClient } from "./resolveProjectAnalysisAuthority.server";
import {
  replaceRedesignCandidatesWithClient,
  type RedesignPersistenceClient,
} from "./repositories/redesign-concepts.repository.server";

export type RunAuthenticatedRedesignGenerationInput = {
  userId: string;
  supabase: RedesignPersistenceClient;
  projectId: string;
  styles?: RedesignStyle[];
};

export async function runAuthenticatedRedesignGeneration(
  input: RunAuthenticatedRedesignGenerationInput,
): Promise<DurableRedesignConcept[]> {
  const key = rateLimitKeyForUser(input.userId, "ai-redesign");
  const rl = checkRateLimit(key);
  if (!rl.allowed) {
    throw new Error(`Rate limit exceeded. Try again in ${rl.retryAfter || 60}s.`);
  }

  const analyses = await resolveCurrentProjectAnalysisAuthorityWithClient(input.supabase, {
    userId: input.userId,
    projectId: input.projectId,
  });

  const analysisIdentity = analysisIdentityFromPhotoIds(analyses.map((a) => a.photo_id));
  if (!analysisIdentity) {
    throw new Error("Cannot generate Redesign without durable Analysis photo identity.");
  }

  const { runSecureRedesignGeneration } = await import("./adapters/ai-redesign.adapter.server");
  const concepts = await runSecureRedesignGeneration({
    projectId: input.projectId,
    styles: input.styles,
    analyses,
  });

  return replaceRedesignCandidatesWithClient(input.supabase, {
    projectId: input.projectId,
    analysisIdentity,
    concepts,
  });
}
