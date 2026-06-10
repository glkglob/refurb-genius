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
import { hasProAccess } from "@/features/payment";
import { auth } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { captureElementScreenshot } from "../../infrastructure";

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
    mutationFn: async (request) => {
      if (!hasProAccess(auth.getUser())) {
        throw new Error("Feasibility export is a Pro feature. Please upgrade to continue.");
      }

      const screenshots = request.screenshots ?? (await collectAppendixScreenshots());
      const result = await generateFeasibilityReport({
        ...request,
        screenshots,
      });
      trackEvent("report_exported", {
        report_type: "feasibility-study",
        study_id: request.studyId,
      });
      return result;
    },
  });
}

async function collectAppendixScreenshots(): Promise<FeasibilityScreenshot[]> {
  if (typeof document === "undefined") return [];

  const floorplanElement = document.querySelector<HTMLElement>("[data-floorplan-stage] canvas");
  if (!floorplanElement) return [];

  const image = await captureElementScreenshot(floorplanElement);
  return [{ title: "3D Floorplan Snapshot", dataUrl: image.dataUrl }];
}
