import type {
  FeasibilityStudyExportRequest,
  ExportReportResult,
  PitchDeckExportRequest,
  ProjectReportExportRequest,
} from "../domain";

export interface PdfExporterPort {
  exportProjectReport(request: ProjectReportExportRequest): Promise<ExportReportResult>;
  exportPitchDeck(request: PitchDeckExportRequest): Promise<ExportReportResult>;
  exportFeasibilityStudy(request: FeasibilityStudyExportRequest): Promise<ExportReportResult>;
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

export type QueueFeasibilityStudyExportInput = {
  studyId: string;
  userId?: string;
};

export type SaveFeasibilityStudyExportInput = {
  studyId: string;
  userId?: string;
  blob?: Blob;
  filename: string;
  pageCount?: number;
  metadata: Record<string, unknown>;
};

export interface ExportRepositoryPort {
  savePitchDeckExport(input: SavePitchDeckExportInput): Promise<SavePitchDeckExportResult>;
  queueFeasibilityStudyExport(input: QueueFeasibilityStudyExportInput): Promise<void>;
  saveFeasibilityStudyExport(input: SaveFeasibilityStudyExportInput): Promise<void>;
}
