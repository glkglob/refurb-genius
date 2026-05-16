// Deal Copilot — acquisition intelligence namespace.
//
// This module starts with lightweight manual deal opportunities. It must
// reuse shared Refurb Genius engines for pricing, ROI, reporting, and AI
// language helpers. Do not fork pricing or ROI calculations here.

export { getMissingDealFields, scoreDealOpportunity } from "./dealScore";

export type { DealScoreInput, DealScoreResult } from "./dealScore";

export { createDealOpportunity, isDealReadyForUnderwriting } from "@repo/types";

export type {
  DealExitStrategy,
  DealOpportunity,
  DealOpportunityInput,
  DealOpportunityStatus,
} from "@repo/types";

export {
  clearDealOpportunityStore,
  deleteDealOpportunity,
  getDealOpportunityById,
  listDealOpportunities,
  opportunityStore,
  saveDealOpportunity,
  updateDealOpportunity,
} from "./opportunityStore";

export type { OpportunityStoreSnapshot } from "./opportunityStore";
