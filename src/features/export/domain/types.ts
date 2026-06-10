import type { ExportPdfOptions } from "@/lib/exportPdf";
import type { GeneratePitchDeckOptions, PitchDeckData } from "@/lib/pitchDeck";

export const EXPORT_REPORT_TYPES = ["project-report", "pitch-deck", "feasibility-study"] as const;
export type ExportReportType = (typeof EXPORT_REPORT_TYPES)[number];

export type ExportMetadata = {
  reportType: ExportReportType;
  format: "pdf";
  generatedAtIso: string;
  generatorVersion: string;
  projectId?: string;
};

export type FeasibilityScreenshot = {
  title: string;
  dataUrl: string;
};

export type FeasibilityReportStudy = {
  id: string;
  projectId: string;
  property: { name: string };
  status: string;
  roomAnalyses: Array<unknown>;
  scope: { rooms: Array<unknown> };
  estimate: { mid_total: number };
  roi: {
    baseMetrics: {
      roi: number;
      estimated_profit: number;
      investment_score: number;
      risk_level: string;
    };
    scenarios: Array<{
      name: string;
      metrics: {
        roi: number;
        investment_score: number;
      };
    }>;
  };
};

export type ProjectReportExportRequest = {
  type: "project-report";
  filename: string;
  options?: ExportPdfOptions;
  metadata: ExportMetadata;
};

export type PitchDeckExportRequest = {
  type: "pitch-deck";
  filenamePrefix: string;
  data: PitchDeckData;
  options?: GeneratePitchDeckOptions;
  metadata: ExportMetadata;
};

export type FeasibilityStudyExportRequest = {
  type: "feasibility-study";
  studyId: string;
  filename: string;
  study: FeasibilityReportStudy;
  screenshots?: FeasibilityScreenshot[];
  options?: ExportPdfOptions;
  metadata: ExportMetadata;
};

export type ExportReportRequest =
  | ProjectReportExportRequest
  | PitchDeckExportRequest
  | FeasibilityStudyExportRequest;

export type ExportReportResult = {
  type: ExportReportType;
  filename: string;
  metadata: ExportMetadata;
  blob?: Blob;
  pageCount?: number;
  storagePath?: string;
  recordId?: string;
};
