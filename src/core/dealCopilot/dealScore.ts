// Backward compatibility shim. Deal scoring has been extracted to @repo/services.
// Use @repo/services directly for new code.

export { getMissingDealFields, scoreDealOpportunity } from "@repo/services";
export type { DealScoreInput, DealScoreResult } from "@repo/services";
