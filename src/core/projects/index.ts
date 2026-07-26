// Shared project surface: pure domain (C4a/C4c-5) and mocks.
//
// Prefer pure domain imports from `@/core/projects/domain`.
// projectStore runtime retired (C4c-5). Live Projects client cache: React Query + useProjects*.
// Photo ownership (C5-4): types → @/lib/photos-types; writes → @/lib/photos-write;
// reads → @/lib/queries/projects; format helpers → @/lib/file-utils. No photoStore.

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
