import { useMutation } from "@tanstack/react-query";
import {
  buildExportMetadata,
  type ExportReportResult,
  type FeasibilityScreenshot,
  type PitchDeckExportRequest,
  type ProjectReportExportRequest,
} from "../../domain";
import { makeGenerateFeasibilityReport, makeGenerateProjectReport } from "../../application";
import { legacyPdfExporter, supabaseExportRepository } from "../../infrastructure";
import { createDefaultFeasibilityService } from "@/features/feasibility";

const generateProjectReport = makeGenerateProjectReport({
  exporter: legacyPdfExporter,
  repository: supabaseExportRepository,
});

const feasibilityService = createDefaultFeasibilityService();
const generateFeasibilityReport = makeGenerateFeasibilityReport({
  exporter: legacyPdfExporter,
  repository: supabaseExportRepository,
  loadStudy: async (studyId) => {
    const study = await feasibilityService.load({ studyId });
    if (!study) {
      throw new Error(`Feasibility study not found: ${studyId}`);
    }
    return study;
  },
});

export function useExportProjectReport() {
  return useMutation<ExportReportResult, Error, Omit<ProjectReportExportRequest, "metadata">>({
    mutationFn: async (request) =>
      generateProjectReport({
        ...request,
        metadata: buildExportMetadata({
          reportType: "project-report",
        }),
      }),
  });
}

export function useExportPitchDeck() {
  return useMutation<
    ExportReportResult,
    Error,
    Omit<PitchDeckExportRequest, "metadata"> & { saveToProject?: { userId: string } }
  >({
    mutationFn: async (request) =>
      generateProjectReport({
        ...request,
        metadata: buildExportMetadata({
          reportType: "pitch-deck",
          projectId: request.data.project.id,
        }),
      }),
  });
}

export function useExportFeasibilityReport() {
  return useMutation<
    ExportReportResult,
    Error,
    {
      studyId: string;
      filename: string;
      screenshots?: FeasibilityScreenshot[];
      saveToProject?: { userId: string };
    }
  >({
    mutationFn: async (request) => generateFeasibilityReport(request),
  });
}
