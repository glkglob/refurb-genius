// Shared project surface: pure domain (C4a/C4c-5), mocks, transitional photo re-exports.
//
// Prefer pure domain imports from `@/core/projects/domain`.
// projectStore runtime retired (C4c-5). Live Projects client cache: React Query + useProjects*.
// photoStore re-exports are legacy coupling (C5) — do not expand.

export { PROPERTY_TYPES, UK_REGIONS, estimatedRefurbCost, estimatedProfit } from "./domain";
export type {
  Project,
  NewProjectInput,
  ProjectStage,
  ProjectStatus,
  PropertyType,
  UKRegion,
} from "./domain";

export { MOCK_PROJECTS, getMockProjectById } from "./mockProjects";

export { photoStore, formatFileSize } from "@/lib/photos";
export type { ProjectPhoto } from "@/lib/photos";
