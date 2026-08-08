/**
 * IA-6-R1 — Subscribe to transient per-project workflow operation running flags.
 */
import { useSyncExternalStore } from "react";
import {
  getProjectWorkflowOperationFlags,
  subscribeProjectWorkflowOperations,
  type ProjectWorkflowOperationFlags,
} from "../projectWorkflowOperationRegistry";

const EMPTY: ProjectWorkflowOperationFlags = {
  photosOperationRunning: false,
  analysisOperationRunning: false,
  redesignOperationRunning: false,
  scopeOperationRunning: false,
  estimateOperationRunning: false,
  exportOperationRunning: false,
};

export function useProjectWorkflowOperationFlags(projectId: string): ProjectWorkflowOperationFlags {
  return useSyncExternalStore(
    (onStoreChange) => subscribeProjectWorkflowOperations(projectId, onStoreChange),
    () => getProjectWorkflowOperationFlags(projectId),
    () => EMPTY,
  );
}
