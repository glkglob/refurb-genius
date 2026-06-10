import type { ExportCapability } from "./ports";

export type QueueFeasibilityExportCommand = {
  studyId: string;
};

export type QueueFeasibilityExportDeps = {
  exports?: ExportCapability;
};

export function makeQueueFeasibilityExport({ exports }: QueueFeasibilityExportDeps) {
  return async function queueFeasibilityExport(
    command: QueueFeasibilityExportCommand,
  ): Promise<void> {
    if (!exports) {
      throw new Error("Export capability is not configured.");
    }

    await exports.queueFeasibilityReport(command.studyId);
  };
}
