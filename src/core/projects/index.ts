// Shared project domain: entity, store, derived helpers.
// Canonical implementation lives in src/lib/projects.ts.
export {
  projectStore,
  estimatedRefurbCost,
  estimatedProfit,
  PROPERTY_TYPES,
  UK_REGIONS,
} from "@/lib/projects";
export type {
  Project,
  NewProjectInput,
  ProjectStage,
  ProjectStatus,
  PropertyType,
  UKRegion,
} from "@/lib/projects";

export { photoStore, formatFileSize } from "@/lib/photos";
export type { ProjectPhoto } from "@/lib/photos";
