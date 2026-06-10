import { useMutation } from "@tanstack/react-query";
import {
  buildExportMetadata,
  type ExportReportResult,
  type PitchDeckExportRequest,
  type ProjectReportExportRequest,
} from "../../domain";
import { makeGenerateProjectReport } from "../../application";
import { legacyPdfExporter, supabaseExportRepository } from "../../infrastructure";

const generateProjectReport = makeGenerateProjectReport({
  exporter: legacyPdfExporter,
  repository: supabaseExportRepository,
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
