// Deal Copilot — acquisition intelligence namespace.
//
// This module starts with lightweight manual deal opportunities. It must
// reuse shared Refurb Genius engines for pricing, ROI, reporting, and AI
// language helpers. Do not fork pricing or ROI calculations here.

export { getMissingDealFields, scoreDealOpportunity } from "./dealScore";

export type { DealScoreInput, DealScoreResult } from "./dealScore";

export { createDealOpportunity, isDealReadyForUnderwriting } from "./opportunity";

export type {
  DealExitStrategy,
  DealOpportunity,
  DealOpportunityInput,
  DealOpportunityStatus,
} from "./opportunity";

export {
  clearDealOpportunityStore,
  deleteDealOpportunity,
  getDealOpportunityById,
  listDealOpportunities,
  saveDealOpportunity,
  updateDealOpportunity,
} from "./opportunityStore";
