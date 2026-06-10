import type { PdfExporterPort } from "../application";
import type {
  ExportReportResult,
  PitchDeckExportRequest,
  ProjectReportExportRequest,
} from "../domain";

export class LegacyPdfExporter implements PdfExporterPort {
  async exportProjectReport(request: ProjectReportExportRequest): Promise<ExportReportResult> {
    const { exportReportPdf } = await import("@/lib/exportPdf");
    await exportReportPdf({
      filename: request.filename,
      ...request.options,
    });

    return {
      type: request.type,
      filename: `${request.filename}.pdf`,
      metadata: request.metadata,
    };
  }

  async exportPitchDeck(request: PitchDeckExportRequest): Promise<ExportReportResult> {
    const { generatePitchDeckPDF } = await import("@/lib/pitchDeck");
    const generated = await generatePitchDeckPDF(request.data, request.options);

    return {
      type: request.type,
      filename: generated.filename,
      metadata: request.metadata,
      blob: generated.blob,
      pageCount: generated.pageCount,
    };
  }
}

export const legacyPdfExporter: PdfExporterPort = new LegacyPdfExporter();
