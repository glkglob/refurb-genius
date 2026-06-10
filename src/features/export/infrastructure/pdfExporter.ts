import type { PdfExporterPort } from "../application";
import type {
  ExportReportResult,
  FeasibilityStudyExportRequest,
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

  async exportFeasibilityStudy(
    request: FeasibilityStudyExportRequest,
  ): Promise<ExportReportResult> {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([595.28, 841.89]); // A4 portrait in points

    const drawLine = (text: string, y: number, size = 11) => {
      page.drawText(text, {
        x: 40,
        y,
        size,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
    };

    drawLine("Property Feasibility Study", 800, 18);
    drawLine(`Study ID: ${request.study.id}`, 775);
    drawLine(`Project: ${request.study.property.name}`, 758);
    drawLine(`Generated: ${request.metadata.generatedAtIso}`, 741);
    drawLine(`Status: ${request.study.status}`, 724);

    drawLine("Executive Summary", 690, 14);
    drawLine(
      `ROI: ${request.study.roi.baseMetrics.roi.toFixed(1)}% | Profit: £${Math.round(
        request.study.roi.baseMetrics.estimated_profit,
      ).toLocaleString()}`,
      670,
    );
    drawLine(
      `Investment Score: ${request.study.roi.baseMetrics.investment_score.toFixed(1)} (${request.study.roi.baseMetrics.risk_level})`,
      653,
    );
    drawLine(`Rooms Analysed: ${request.study.roomAnalyses.length}`, 636);
    drawLine(`Scope Rooms: ${request.study.scope.rooms.length}`, 619);
    drawLine(
      `Estimate Mid Total: £${Math.round(request.study.estimate.mid_total).toLocaleString()}`,
      602,
    );

    drawLine("Scenario Summary", 568, 14);
    request.study.roi.scenarios.slice(0, 3).forEach((scenario, index) => {
      drawLine(
        `${scenario.name}: ROI ${scenario.metrics.roi.toFixed(1)}% | Score ${scenario.metrics.investment_score.toFixed(1)}`,
        548 - index * 17,
      );
    });

    if (request.screenshots && request.screenshots.length > 0) {
      const imagePage = pdf.addPage([595.28, 841.89]);
      imagePage.drawText("Appendix — Embedded Visuals", {
        x: 40,
        y: 800,
        size: 14,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });

      let cursorY = 760;
      for (const screenshot of request.screenshots.slice(0, 3)) {
        const pngBytes = dataUrlToUint8Array(screenshot.dataUrl);
        const png = await pdf.embedPng(pngBytes);
        const width = 500;
        const height = Math.max(120, Math.min(220, (png.height / png.width) * width));

        imagePage.drawText(screenshot.title, {
          x: 40,
          y: cursorY + 8,
          size: 10,
          font,
          color: rgb(0.25, 0.25, 0.25),
        });

        imagePage.drawImage(png, {
          x: 40,
          y: cursorY - height,
          width,
          height,
        });

        cursorY -= height + 34;
        if (cursorY < 120) break;
      }
    }

    const bytes = await pdf.save();
    const blobBytes = Uint8Array.from(bytes);
    const blob = new Blob([blobBytes], { type: "application/pdf" });
    const filename = `${request.filename}.pdf`;

    triggerDownload(blob, filename);

    return {
      type: request.type,
      filename,
      metadata: request.metadata,
      blob,
      pageCount: pdf.getPageCount(),
    };
  }
}

export const legacyPdfExporter: PdfExporterPort = new LegacyPdfExporter();

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const [meta, base64] = dataUrl.split(",", 2);
  if (!meta?.startsWith("data:image/") || !base64) {
    throw new Error("Invalid image data URL.");
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
