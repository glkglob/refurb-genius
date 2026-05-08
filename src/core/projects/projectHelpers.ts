// Reusable project helpers. Pure (or thin async) wrappers around the
// canonical projectStore so pages/components don't reimplement CRUD or
// progress logic. Future products (Deal Copilot, Refurb IQ) consume the
// same helpers.
import {
  projectStore,
  estimatedRefurbCost,
  estimatedProfit,
  type Project,
  type ProjectStatus,
  type ProjectStage,
  type NewProjectInput,
} from "@/lib/projects";

export type ProjectProgress = Record<ProjectStage, boolean> & {
  /** 0–1 share of stages complete. */
  ratio: number;
  /** Number of completed stages. */
  completed: number;
  /** Total stage count. */
  total: number;
  /** Next incomplete stage, or null if everything is done. */
  nextStage: ProjectStage | null;
};

const STAGES: ProjectStage[] = ["photos", "analysis", "estimate", "report"];

/** Create a new project owned by the current user. */
export async function createProject(input: NewProjectInput): Promise<Project> {
  return projectStore.create(input);
}

/**
 * Update a project. The current store only persists per-stage flags via
 * `setStage`, so this helper routes stage updates through it and leaves a
 * TODO for general field updates until a store-level update API exists.
 */
export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, "status">> & {
    stages?: Partial<Record<ProjectStage, boolean>>;
  },
): Promise<void> {
  if (patch.stages) {
    for (const stage of STAGES) {
      const value = patch.stages[stage];
      if (typeof value === "boolean") projectStore.setStage(id, stage, value);
    }
  }
  // TODO: extend projectStore with a generic `update(id, patch)` for
  // arbitrary field edits (name, address, pricing, status, etc.) and
  // forward them here. Avoiding a guessed implementation today.
}

/** Fetch a project from the in-memory cache by id. */
export function getProjectById(id: string): Project | undefined {
  return projectStore.get(id);
}

/** Read the persisted lifecycle status (Draft / Analysing / …). */
export function getProjectStatus(id: string): ProjectStatus | undefined {
  return projectStore.get(id)?.status;
}

/** Per-stage completion + derived ratio + next actionable stage. */
export function calculateProjectProgress(id: string): ProjectProgress {
  const flags = projectStore.getProgress(id);
  const completed = STAGES.filter((s) => flags[s]).length;
  const nextStage = STAGES.find((s) => !flags[s]) ?? null;
  return {
    ...flags,
    completed,
    total: STAGES.length,
    ratio: completed / STAGES.length,
    nextStage,
  };
}

// Re-export derived money helpers so callers have a single import surface.
export { estimatedRefurbCost, estimatedProfit };
