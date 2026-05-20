import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CONDITION_LEVELS, REFURB_LEVELS, ROOM_TYPES } from "./mockAnalysis";
import { REDESIGN_STYLES } from "@/lib/redesign";

const photoInputSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
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

export const runPhotoAnalysisServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => runPhotoAnalysisInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { runSecurePhotoAnalysis } = await import("./server/openAiVision.server");
    return runSecurePhotoAnalysis(data);
  });

export const generateRedesignConceptsServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => runRedesignInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { runSecureRedesignGeneration } = await import("./server/openAiRedesign.server");
    return runSecureRedesignGeneration(data);
  });
