// Backward compatibility shim. DealOpportunity types have been extracted to @repo/types.
// Use @repo/types directly for new code.

export type {
  DealOpportunity,
  DealOpportunityInput,
  DealOpportunityStatus,
  DealExitStrategy,
} from "@repo/types";
export { createDealOpportunity, isDealReadyForUnderwriting } from "@repo/types";
