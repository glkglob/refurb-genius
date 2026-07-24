// Shared project surface: pure domain (C4a), store facade, helpers, mocks.
//
// Prefer pure domain imports from `@/core/projects/domain`.
// Store / browser persistence remain transitional (C4b/C4c).
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

export { projectStore } from "./projectStore";
export {
  createProject,
  updateProject,
  getProjectById,
  getProjectStatus,
  calculateProjectProgress,
  type ProjectProgress,
} from "./projectHelpers";
export { MOCK_PROJECTS, getMockProjectById } from "./mockProjects";

export { photoStore, formatFileSize } from "@/lib/photos";
export type { ProjectPhoto } from "@/lib/photos";
