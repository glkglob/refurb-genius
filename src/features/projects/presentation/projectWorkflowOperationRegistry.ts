/**
 * IA-6-R1 — Transient cross-route workflow operation running registry.
 *
 * Browser-only, in-memory on globalThis (single store across import paths).
 * Not durable across full page refresh.
 *
 * Publishes genuine stage-operation running signals so Dashboard/Overview
 * (via useProjectFiveStageWorkflow) can compose view_stage_progress.
 *
 * Does NOT invent authority, currentness, or a second resolver.
 */

export type ProjectWorkflowOperationStage =
  | "photos"
  | "analysis"
  | "redesign"
  | "scope"
  | "estimate"
  | "export";

export type ProjectWorkflowOperationFlags = {
  photosOperationRunning: boolean;
  analysisOperationRunning: boolean;
  redesignOperationRunning: boolean;
  scopeOperationRunning: boolean;
  estimateOperationRunning: boolean;
  exportOperationRunning: boolean;
};

const EMPTY_FLAGS: ProjectWorkflowOperationFlags = Object.freeze({
  photosOperationRunning: false,
  analysisOperationRunning: false,
  redesignOperationRunning: false,
  scopeOperationRunning: false,
  estimateOperationRunning: false,
  exportOperationRunning: false,
});

type StageMap = Map<ProjectWorkflowOperationStage, number>;

type RegistryStore = {
  runningByProject: Map<string, StageMap>;
  listenersByProject: Map<string, Set<() => void>>;
  snapshotByProject: Map<string, ProjectWorkflowOperationFlags>;
  globalListeners: Set<() => void>;
};

const STORE_KEY = "__refurb_genius_project_workflow_ops_v1__";

function store(): RegistryStore {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: RegistryStore };
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = {
      runningByProject: new Map(),
      listenersByProject: new Map(),
      snapshotByProject: new Map(),
      globalListeners: new Set(),
    };
  }
  return g[STORE_KEY]!;
}

function stageKey(stage: ProjectWorkflowOperationStage): keyof ProjectWorkflowOperationFlags {
  switch (stage) {
    case "photos":
      return "photosOperationRunning";
    case "analysis":
      return "analysisOperationRunning";
    case "redesign":
      return "redesignOperationRunning";
    case "scope":
      return "scopeOperationRunning";
    case "estimate":
      return "estimateOperationRunning";
    case "export":
      return "exportOperationRunning";
  }
}

function notify(projectId: string): void {
  const s = store();
  const set = s.listenersByProject.get(projectId);
  if (set) {
    for (const l of set) l();
  }
  for (const l of s.globalListeners) l();
}

/**
 * Set absolute running state for a stage (true/false).
 * Prefer {@link withProjectWorkflowOperationRunning} for refcounted start/end.
 */
export function setProjectWorkflowOperationRunning(
  projectId: string,
  stage: ProjectWorkflowOperationStage,
  running: boolean,
): void {
  if (!projectId) return;
  const s = store();
  let stages = s.runningByProject.get(projectId);
  if (!stages) {
    stages = new Map();
    s.runningByProject.set(projectId, stages);
  }
  const wasRunning = (stages.get(stage) ?? 0) > 0;
  if (running) {
    stages.set(stage, 1);
  } else {
    stages.delete(stage);
  }
  if (stages.size === 0) {
    s.runningByProject.delete(projectId);
  }
  // Invalidate snapshot cache for this project
  s.snapshotByProject.delete(projectId);
  if (wasRunning !== running) {
    notify(projectId);
  }
}

/**
 * Refcounted begin/end for nested or overlapping operations on the same stage.
 */
export function beginProjectWorkflowOperation(
  projectId: string,
  stage: ProjectWorkflowOperationStage,
): void {
  if (!projectId) return;
  const s = store();
  let stages = s.runningByProject.get(projectId);
  if (!stages) {
    stages = new Map();
    s.runningByProject.set(projectId, stages);
  }
  const next = (stages.get(stage) ?? 0) + 1;
  stages.set(stage, next);
  s.snapshotByProject.delete(projectId);
  notify(projectId);
}

export function endProjectWorkflowOperation(
  projectId: string,
  stage: ProjectWorkflowOperationStage,
): void {
  if (!projectId) return;
  const s = store();
  const stages = s.runningByProject.get(projectId);
  if (!stages) return;
  const prev = stages.get(stage) ?? 0;
  if (prev <= 1) {
    stages.delete(stage);
  } else {
    stages.set(stage, prev - 1);
  }
  if (stages.size === 0) {
    s.runningByProject.delete(projectId);
  }
  s.snapshotByProject.delete(projectId);
  notify(projectId);
}

/** Run fn while stage is marked running; always clears on settle (success or throw). */
export async function withProjectWorkflowOperationRunning<T>(
  projectId: string,
  stage: ProjectWorkflowOperationStage,
  fn: () => Promise<T>,
): Promise<T> {
  beginProjectWorkflowOperation(projectId, stage);
  try {
    return await fn();
  } finally {
    endProjectWorkflowOperation(projectId, stage);
  }
}

function computeFlags(projectId: string): ProjectWorkflowOperationFlags {
  const stages = store().runningByProject.get(projectId);
  if (!stages || stages.size === 0) {
    return EMPTY_FLAGS;
  }
  const flags: ProjectWorkflowOperationFlags = {
    photosOperationRunning: false,
    analysisOperationRunning: false,
    redesignOperationRunning: false,
    scopeOperationRunning: false,
    estimateOperationRunning: false,
    exportOperationRunning: false,
  };
  for (const [stage, count] of stages) {
    if (count > 0) {
      flags[stageKey(stage)] = true;
    }
  }
  return flags;
}

function flagsEqual(a: ProjectWorkflowOperationFlags, b: ProjectWorkflowOperationFlags): boolean {
  return (
    a.photosOperationRunning === b.photosOperationRunning &&
    a.analysisOperationRunning === b.analysisOperationRunning &&
    a.redesignOperationRunning === b.redesignOperationRunning &&
    a.scopeOperationRunning === b.scopeOperationRunning &&
    a.estimateOperationRunning === b.estimateOperationRunning &&
    a.exportOperationRunning === b.exportOperationRunning
  );
}

export function getProjectWorkflowOperationFlags(projectId: string): ProjectWorkflowOperationFlags {
  const s = store();
  const next = computeFlags(projectId);
  const prev = s.snapshotByProject.get(projectId);
  if (prev && flagsEqual(prev, next)) {
    return prev;
  }
  if (next === EMPTY_FLAGS || flagsEqual(next, EMPTY_FLAGS)) {
    s.snapshotByProject.delete(projectId);
    return EMPTY_FLAGS;
  }
  s.snapshotByProject.set(projectId, next);
  return next;
}

export function subscribeProjectWorkflowOperations(
  projectId: string,
  listener: () => void,
): () => void {
  const s = store();
  let set = s.listenersByProject.get(projectId);
  if (!set) {
    set = new Set();
    s.listenersByProject.set(projectId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) {
      s.listenersByProject.delete(projectId);
    }
  };
}

/** Test helper — clear all transient running state. */
export function resetProjectWorkflowOperationRegistryForTests(): void {
  const s = store();
  s.runningByProject.clear();
  s.listenersByProject.clear();
  s.snapshotByProject.clear();
  for (const l of s.globalListeners) l();
}
