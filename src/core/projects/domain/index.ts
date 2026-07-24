/**
 * Canonical pure Projects domain public API (C4a).
 *
 * Safe for server and client. No React, Supabase, hooks, or persistence.
 */
export type {
  Project,
  NewProjectInput,
  ProjectStatus,
  ProjectStage,
  PropertyType,
  UKRegion,
} from "./types";
export { PROPERTY_TYPES, UK_REGIONS } from "./constants";
export { estimatedRefurbCost, estimatedProfit } from "./helpers";
