/**
 * Deal Copilot feature — public API.
 *
 * Presentation consumers import opportunity update mutation from here.
 * Infrastructure is intentionally not re-exported.
 * List/detail/save/delete remain on transitional @/hooks/useOpportunities
 * and core opportunityStore (out of AO-1M5).
 */
export {
  useUpdateOpportunity,
  type UpdateOpportunityVariables,
} from "./presentation/hooks/useUpdateOpportunity";
