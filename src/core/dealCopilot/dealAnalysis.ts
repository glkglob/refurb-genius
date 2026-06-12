/**
 * Deal Copilot — AI deal-analysis contract (pure, isomorphic).
 *
 * This module holds ONLY the Zod schema + inferred types for the structured
 * AI deal analysis. It has no server or browser imports, so both the
 * server-only adapter (`server/dealAnalysis.adapter.server.ts`) and the client
 * card (`components/deal-copilot/DealAnalysisCard.tsx`) can import from it.
 *
 * Design note (hybrid model): the deterministic pricing-authority + dealScore
 * engines (@repo/services, guarded by invariant tests) remain the authoritative
 * source for valuation / ROI. The AI MAY additionally offer its own independent
 * estimate in `aiOpinion`, but those numbers are presented as opinion only and
 * never replace the engine figures. The bulk of the output is qualitative:
 * a narrative summary, risk flags, suggested next steps, and optional comps.
 */
import { z } from "zod";

export const dealRiskSeveritySchema = z.enum(["high", "medium", "low"]);
export type DealRiskSeverity = z.infer<typeof dealRiskSeveritySchema>;

export const dealRiskFlagSchema = z.object({
  severity: dealRiskSeveritySchema,
  description: z.string().min(1),
  mitigation: z.string().optional(),
});
export type DealRiskFlag = z.infer<typeof dealRiskFlagSchema>;

export const dealCompSchema = z.object({
  address: z.string().min(1),
  note: z.string().optional(),
});
export type DealComp = z.infer<typeof dealCompSchema>;

/**
 * The AI's own independent estimate. Opinion only — the deterministic engine
 * remains authoritative. All fields optional: the model omits a figure it
 * cannot reason about from the provided data.
 */
export const dealAiOpinionSchema = z.object({
  estimatedValue: z.number().positive().optional(),
  refurbCost: z.number().positive().optional(),
  projectedRoiPercent: z.number().min(-50).max(200).optional(),
  rationale: z.string().optional(),
});
export type DealAiOpinion = z.infer<typeof dealAiOpinionSchema>;

export const dealAnalysisSchema = z.object({
  valuationSummary: z.string().min(1),
  riskFlags: z.array(dealRiskFlagSchema),
  nextSteps: z.array(z.string().min(1)),
  comps: z.array(dealCompSchema).optional(),
  aiOpinion: dealAiOpinionSchema.optional(),
});
export type DealAnalysis = z.infer<typeof dealAnalysisSchema>;
