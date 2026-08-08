/**
 * IA-5 — Pure Export (report) workflow-state adapter for the IA-2 resolver.
 *
 * Currentness:
 *   export current iff durable snapshot exists AND Estimate is current AND
 *   snapshot.estimateId == currentEstimateId
 *
 * Page view and download clicks are NOT authority.
 * Legacy projects.report_done is never an input.
 */

import type { ExportWorkflowState, WorkflowAuthorityCurrency } from "./projectWorkflowState";

export type ExportSnapshotEvidence = {
  id: string;
  estimateId: string;
};

export type ExportAdapterInput = {
  estimateCurrency: WorkflowAuthorityCurrency;
  currentEstimateId: string;
  /** Latest export snapshot for the project (if any). */
  snapshot: ExportSnapshotEvidence | null;
  exportOperationRunning?: boolean;
};

export function exportCurrencyFromEvidence(input: ExportAdapterInput): ExportWorkflowState {
  if (input.exportOperationRunning) {
    return { currency: "running" };
  }

  if (input.estimateCurrency !== "current") {
    if (input.snapshot) {
      return { currency: "non_current" };
    }
    return { currency: "absent" };
  }

  if (!input.snapshot) {
    return { currency: "absent" };
  }

  if (input.currentEstimateId.length > 0 && input.snapshot.estimateId === input.currentEstimateId) {
    return { currency: "current" };
  }

  return { currency: "non_current" };
}

export function exportShellFlagsFromCurrency(currency: WorkflowAuthorityCurrency): {
  reportDone: boolean;
  reportNeedsAttention: boolean;
} {
  switch (currency) {
    case "current":
      return { reportDone: true, reportNeedsAttention: false };
    case "non_current":
      return { reportDone: true, reportNeedsAttention: true };
    case "running":
    case "absent":
      return { reportDone: false, reportNeedsAttention: false };
  }
}
