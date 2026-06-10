import type { FeasibilityStudy } from "@/features/feasibility";
import type { FeasibilityScreenshot } from "../domain";
import { buildExportMetadata } from "../domain";
import type { ExportReportResult } from "../domain";
import { makeGenerateProjectReport, type GenerateProjectReportDeps } from "./generateProjectReport";

export type GenerateFeasibilityReportCommand = {
  studyId: string;
  filename: string;
  screenshots?: FeasibilityScreenshot[];
  saveToProject?: {
    userId: string;
  };
};

export type GenerateFeasibilityReportDeps = GenerateProjectReportDeps & {
  loadStudy: (studyId: string) => Promise<FeasibilityStudy>;
};

export function makeGenerateFeasibilityReport({
  exporter,
  repository,
  loadStudy,
}: GenerateFeasibilityReportDeps) {
  const generateProjectReport = makeGenerateProjectReport({ exporter, repository });

  return async function generateFeasibilityReport(
    command: GenerateFeasibilityReportCommand,
  ): Promise<ExportReportResult> {
    const study = await loadStudy(command.studyId);
    return generateProjectReport({
      type: "feasibility-study",
      studyId: command.studyId,
      filename: command.filename,
      study,
      screenshots: command.screenshots,
      saveToProject: command.saveToProject,
      metadata: buildExportMetadata({
        reportType: "feasibility-study",
        projectId: study.projectId,
      }),
    });
  };
}
