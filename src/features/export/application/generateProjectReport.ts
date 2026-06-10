import {
  ensureValidExportRequest,
  type ExportReportRequest,
  type ExportReportResult,
} from "../domain";
import type { ExportRepositoryPort, PdfExporterPort } from "./ports";

export type GenerateProjectReportCommand = ExportReportRequest & {
  saveToProject?: {
    userId: string;
  };
};

export type GenerateProjectReportDeps = {
  exporter: PdfExporterPort;
  repository?: ExportRepositoryPort;
};

export function makeGenerateProjectReport({ exporter, repository }: GenerateProjectReportDeps) {
  return async function generateProjectReport(
    command: GenerateProjectReportCommand,
  ): Promise<ExportReportResult> {
    ensureValidExportRequest(command);

    if (command.type === "project-report") {
      return exporter.exportProjectReport(command);
    }

    const generated = await exporter.exportPitchDeck(command);
    if (!command.saveToProject || !repository || !generated.blob || !generated.pageCount) {
      return generated;
    }

    const saved = await repository.savePitchDeckExport({
      projectId: command.data.project.id,
      userId: command.saveToProject.userId,
      blob: generated.blob,
      filename: generated.filename,
      pageCount: generated.pageCount,
    });

    return {
      ...generated,
      storagePath: saved.storagePath,
      recordId: saved.recordId,
    };
  };
}
