/**
 * Shared authenticated Scope analysis runner.
 *
 * Web cookie serverFn and native Bearer handler both delegate here.
 * Identity and the user-scoped Supabase client are injected by the caller.
 */
import "@tanstack/react-start/server-only";

import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit";
import {
  assertScopeAnalysisResult,
  type ScopeAnalysisInput,
  type ScopeAnalysisResult,
} from "../domain";
import type { ScopeAnalysisAuthClient } from "./adapters/ai-scope.adapter.server";

export type RunAuthenticatedScopeAnalysisInput = {
  userId: string;
  supabase: ScopeAnalysisAuthClient;
  analysis: ScopeAnalysisInput;
};

export async function runAuthenticatedScopeAnalysis(
  input: RunAuthenticatedScopeAnalysisInput,
): Promise<ScopeAnalysisResult> {
  const key = rateLimitKeyForUser(input.userId, "ai-scope");
  const rl = checkRateLimit(key);
  if (!rl.allowed) {
    throw new Error(`Rate limit exceeded. Try again in ${rl.retryAfter || 60}s.`);
  }

  const { runSecureScopeAnalysis } = await import("./adapters/ai-scope.adapter.server");
  const result = await runSecureScopeAnalysis(
    {
      ...input.analysis,
      photos: input.analysis.photos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        name: photo.name,
        size: photo.size,
      })),
    },
    { userId: input.userId, supabase: input.supabase },
  );
  return assertScopeAnalysisResult(result);
}
