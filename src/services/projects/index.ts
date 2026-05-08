// Projects service boundary.
//
// Database CRUD for projects and per-project derived helpers. Components
// and pages should import from `@/services/projects` instead of touching
// the underlying store directly. Today this re-exports the shared core
// module; tomorrow we can swap in a server-fn-backed implementation
// without changing UI imports.
export {
  projectStore,
  createProject,
  updateProject,
  getProjectById,
  getProjectStatus,
  calculateProjectProgress,
  estimatedRefurbCost,
  estimatedProfit,
  MOCK_PROJECTS,
  getMockProjectById,
  PROPERTY_TYPES,
  UK_REGIONS,
} from "@/core/projects";

export type {
  Project,
  ProjectStatus,
  ProjectStage,
  NewProjectInput,
  PropertyType,
  UKRegion,
  ProjectProgress,
} from "@/core/projects";
