import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CONDITION_LEVELS, REFURB_LEVELS, ROOM_TYPES } from "./mockAnalysis";
import { REDESIGN_STYLES } from "@/lib/redesign";

const photoInputSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  name: z.string().min(1),
  size: z.number().nonnegative().optional(),
});

const roomAnalysisSchema = z.object({
  id: z.string().min(1),
  photo_url: z.string().min(1),
  photo_name: z.string().min(1),
  room_type: z.enum(ROOM_TYPES),
  condition_level: z.enum(CONDITION_LEVELS),
  refurbishment_level: z.enum(REFURB_LEVELS),
  visible_issues: z.array(z.string()),
  recommended_works: z.array(z.string()),
  ai_summary: z.string(),
  confidence_score: z.number(),
  source: z.enum(["ai", "mock", "fallback", "persisted"]),
});

const runPhotoAnalysisInputSchema = z.object({
  projectId: z.string().min(1),
  photos: z.array(photoInputSchema),
});

const runRedesignInputSchema = z.object({
  projectId: z.string().min(1),
  styles: z.array(z.enum(REDESIGN_STYLES)).optional(),
  analyses: z.array(roomAnalysisSchema).optional(),
});

async function requireServerAuth(): Promise<void> {
  const { getCookies } = await import("@tanstack/react-start/server");
  const { createServerSupabase } = await import("@repo/supabase/server");

  const supabase = createServerSupabase(getCookies());

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthorized: you must be signed in to use AI features.");
  }
}

export const runPhotoAnalysisServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => runPhotoAnalysisInputSchema.parse(input))
  .handler(async ({ data }) => {
    await requireServerAuth();
    const { runSecurePhotoAnalysis } = await import("./server/openAiVision.server");
    return runSecurePhotoAnalysis(data);
  });

export const generateRedesignConceptsServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => runRedesignInputSchema.parse(input))
  .handler(async ({ data }) => {
    await requireServerAuth();
    const { runSecureRedesignGeneration } = await import("./server/openAiRedesign.server");
    return runSecureRedesignGeneration(data);
  });

// ──────────────────────────────────────────────────────────────
// AI estimate generation
// ──────────────────────────────────────────────────────────────

const generateEstimateInputSchema = z.object({
  propertyType: z.string().min(1),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(0).max(10).optional(),
  region: z.string().min(1),
  postcode: z.string().optional(),
  condition: z.string().min(1),
  requirements: z.string(),
  sizeSqm: z.number().positive().optional(),
});

export const generateEstimateServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => generateEstimateInputSchema.parse(input))
  .handler(async ({ data }) => {
    await requireServerAuth();
    const { runSecureEstimateGeneration } = await import("./server/openAiEstimate.server");
    return runSecureEstimateGeneration(data);
  });

// ──────────────────────────────────────────────────────────────
// AI scope analysis (photo → condition + costed scope)
// ──────────────────────────────────────────────────────────────

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
    await requireServerAuth();
    // // LIGHT / FAST / FALLBACK path (see docs/architecture/analysis-paths.md)
    // Primary heavy analysis uses Railway Python async jobs.
    // This TS path (and siblings for estimate/redesign/vision) is for
    // low-latency interactive use + fallback when Railway unavailable.
    const { runSecureScopeAnalysis } = await import("./server/openAiScopeAnalysis.server");
    return runSecureScopeAnalysis(data);
  });
