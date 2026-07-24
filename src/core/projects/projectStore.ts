// Compatibility re-export of the browser project store (C4b owns redesign).
// Types come from the pure domain (C4a).
export { projectStore } from "@/lib/projects";
export type {
  Project,
  ProjectStatus,
  ProjectStage,
  NewProjectInput,
  PropertyType,
  UKRegion,
} from "@/core/projects/domain";
