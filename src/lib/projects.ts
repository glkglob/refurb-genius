// Compatibility re-exports only (C4b).
//
// Canonical pure domain: @/core/projects/domain
// Canonical projectStore runtime: @/core/projects/projectStore
// This module must not host store state, Supabase calls, or auth subscriptions.

export type {
  Project,
  NewProjectInput,
  ProjectStatus,
  ProjectStage,
  PropertyType,
  UKRegion,
} from "@/core/projects/domain";
export {
  PROPERTY_TYPES,
  UK_REGIONS,
  estimatedRefurbCost,
  estimatedProfit,
} from "@/core/projects/domain";

export { projectStore } from "@/core/projects/projectStore";
export type { ProjectStoreSnapshot } from "@/core/projects/projectStore";
