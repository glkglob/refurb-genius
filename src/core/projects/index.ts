// Shared project domain: store, helpers, mocks, types, constants.
// Canonical source for project business logic across products.
//
// TODO(deal-copilot): acquisition pipeline, opportunities, saved searches,
// and automation will all wrap `projectStore` + `createProject` rather than
// fork the schema. Opportunities convert into `Project` rows on underwrite.

export { projectStore } from "./projectStore";
export {
  createProject,
  updateProject,
  getProjectById,
  getProjectStatus,
  calculateProjectProgress,
  estimatedRefurbCost,
  estimatedProfit,
  type ProjectProgress,
} from "./projectHelpers";
export { MOCK_PROJECTS, getMockProjectById } from "./mockProjects";

export { PROPERTY_TYPES, UK_REGIONS } from "@/lib/projects";
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
