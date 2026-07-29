/**
 * Deal Copilot feature — public API.
 *
 * Presentation consumers import mutation hooks from here.
 * Infrastructure and server functions are intentionally not re-exported.
 * List/detail/save/delete remain on transitional @/hooks/useOpportunities
 * and core opportunityStore (out of AO-1M5 / AO-1M6).
 */
export {
  useUpdateOpportunity,
  type UpdateOpportunityVariables,
} from "./presentation/hooks/useUpdateOpportunity";

export {
  useAnalyzeDealOpportunity,
  type AnalyzeDealOpportunityVariables,
} from "./presentation/hooks/useAnalyzeDealOpportunity";
