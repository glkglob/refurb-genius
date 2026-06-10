import type { ExportPdfOptions } from "@/lib/exportPdf";
import type { GeneratePitchDeckOptions, PitchDeckData } from "@/lib/pitchDeck";

export const EXPORT_REPORT_TYPES = ["project-report", "pitch-deck"] as const;
export type ExportReportType = (typeof EXPORT_REPORT_TYPES)[number];

export type ExportMetadata = {
  reportType: ExportReportType;
  format: "pdf";
  generatedAtIso: string;
  generatorVersion: string;
  projectId?: string;
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

export type ExportReportRequest = ProjectReportExportRequest | PitchDeckExportRequest;

export type ExportReportResult = {
  type: ExportReportType;
  filename: string;
  metadata: ExportMetadata;
  blob?: Blob;
  pageCount?: number;
  storagePath?: string;
  recordId?: string;
};
