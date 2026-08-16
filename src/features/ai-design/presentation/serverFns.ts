/**
 * AI-design slice — RPC surface (TanStack `createServerFn`).
 * Moved from `src/core/ai/serverFns.ts` (which now re-exports from here).
 *
 * Redesign authority is resolved server-side from current durable room_analyses
 * + current project photo catalogue. Client-supplied analyses are never trusted.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { REDESIGN_STYLES } from "@/lib/redesign";
import { checkRateLimit, rateLimitKeyForUser } from "@/lib/rate-limit";

async function requireServerAuth(): Promise<{ id: string }> {
  // cookieName must match browser client ("pip-auth") or getUser() is always null.
  const { requireUser } = await import("@/serverFns/auth.server");
  const user = await requireUser();
  return { id: user.id };
}

/**
 * Production redesign input: projectId + optional styles only.
 * Optional `analyses` accepted for temporary compatibility but ignored for authority.
 */
const runRedesignInputSchema = z.object({
  projectId: z.string().uuid(),
  styles: z.array(z.enum(REDESIGN_STYLES)).optional(),
  /** @deprecated Ignored. Server re-reads durable authority. */
  analyses: z.unknown().optional(),
});

export const generateRedesignConceptsServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => runRedesignInputSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireServerAuth();
    // Server-side authority only. Client `analyses` are deliberately not used.
    void data.analyses;
    const { createSupabaseServerClient } = await import("@/serverFns/auth.server");
    const supabase = await createSupabaseServerClient();
    const { runAuthenticatedRedesignGeneration } =
      await import("../infrastructure/runAuthenticatedRedesignGeneration.server");
    return runAuthenticatedRedesignGeneration({
      userId: user.id,
      supabase: supabase as never,
      projectId: data.projectId,
      styles: data.styles,
    });
  });

const projectIdSchema = z.object({
  projectId: z.string().uuid(),
});

/** Load durable Redesign candidates + selection for a project. */
export const listRedesignConceptsServerFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => projectIdSchema.parse(input))
  .handler(async ({ data }) => {
    await requireServerAuth();
    const { listDurableRedesignConcepts } =
      await import("../infrastructure/repositories/redesign-concepts.repository.server");
    return listDurableRedesignConcepts(data.projectId);
  });

const selectRedesignSchema = z.object({
  projectId: z.string().uuid(),
  conceptId: z.string().uuid(),
});

/** Explicit user selection — single selected authority after success. */
export const selectRedesignConceptServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => selectRedesignSchema.parse(input))
  .handler(async ({ data }) => {
    await requireServerAuth();
    const { selectDurableRedesignConcept } =
      await import("../infrastructure/repositories/redesign-concepts.repository.server");
    return selectDurableRedesignConcept({
      projectId: data.projectId,
      conceptId: data.conceptId,
    });
  });

const photoSourceSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  name: z.string().min(1),
  size: z.number().nonnegative().optional(),
});

const scopeAnalysisInputSchema = z.object({
  projectId: z.string().min(1),
  photos: z.array(photoSourceSchema),
  roomTags: z.array(z.string()),
  propertyType: z.string().min(1),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(0).max(10).optional(),
  region: z.string().min(1),
  notes: z.string().optional(),
});

export const runScopeAnalysisServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => scopeAnalysisInputSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireServerAuth();
    const key = rateLimitKeyForUser(user.id, "ai-scope");
    const rl = checkRateLimit(key);
    if (!rl.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${rl.retryAfter || 60}s.`);
    }
    const { runSecureScopeAnalysis } =
      await import("../infrastructure/adapters/ai-scope.adapter.server");
    // Client photo.url is identity/compat only — adapter re-resolves by id
    // and signs storage_path. Client URL is never retrieval authority.
    return runSecureScopeAnalysis({
      ...data,
      photos: data.photos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        name: photo.name,
        size: photo.size,
      })),
    });
  });
