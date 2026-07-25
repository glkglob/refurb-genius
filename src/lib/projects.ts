// Compatibility re-exports only (C4b / C4c-5).
//
// Canonical pure domain: @/core/projects/domain
// projectStore runtime retired (C4c-5). Live Projects client cache: React Query + useProjects*.
// This module must not host store state, Supabase calls, auth subscriptions, or mutable caches.

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
