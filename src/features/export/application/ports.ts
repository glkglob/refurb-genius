import type {
  ExportReportResult,
  PitchDeckExportRequest,
  ProjectReportExportRequest,
} from "../domain";

export interface PdfExporterPort {
  exportProjectReport(request: ProjectReportExportRequest): Promise<ExportReportResult>;
  exportPitchDeck(request: PitchDeckExportRequest): Promise<ExportReportResult>;
}

export type SavePitchDeckExportInput = {
  projectId: string;
  userId: string;
  blob: Blob;
  filename: string;
  pageCount: number;
};

export type SavePitchDeckExportResult = {
  storagePath: string;
  recordId?: string;
};

export interface ExportRepositoryPort {
  savePitchDeckExport(input: SavePitchDeckExportInput): Promise<SavePitchDeckExportResult>;
}
