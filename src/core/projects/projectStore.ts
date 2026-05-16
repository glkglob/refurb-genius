// Canonical project store re-export. Pages and helpers should import the
// store from here instead of `@/lib/projects` so future migrations have a
// single touch point.
export { projectStore } from "@/lib/projects";
export type { Project, ProjectStatus, ProjectStage, NewProjectInput } from "@/lib/projects";
