// PDF export helper with timeout + error handling.
//
// Captures the given HTML element as a series of A4 canvas pages and saves
// as a downloadable PDF. Uses html2canvas for DOM capture and jspdf for PDF
// assembly. Cross-origin images (e.g. Supabase Storage) are requested with
// useCORS: true — the Storage bucket must allow the app origin (which it does
// for the public `project-photos` bucket).
//
// This module is async-imported only when the user clicks "Export PDF" so
// html2canvas + jspdf are not part of the main bundle.

import { addDiagnosticBreadcrumb } from "./sentry";
import { logger } from "./logger";

export type ExportPdfOptions = {
  /** Element to capture. Defaults to `document.querySelector('.print-area')`. */
  element?: HTMLElement | null;
  /** Filename without extension. Defaults to "refurb-genius-report". */
  filename?: string;
  /** Scale factor for the canvas (higher = crisper). Defaults to 2. */
  scale?: number;
  /** Optional callback for progress updates. */
  onProgress?: (stage: "loading-libs" | "rendering-canvas" | "generating-pdf" | "complete") => void;
};

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PDF_TIMEOUT_MS = 60_000; // 60s max for entire export

class PdfTimeoutError extends Error {
  readonly name = "PdfTimeoutError";
  constructor(message: string) {
    super(message);
  }
}

export async function exportReportPdf(options: ExportPdfOptions = {}): Promise<void> {
  const {
    element = document.querySelector<HTMLElement>(".print-area"),
    filename = "refurb-genius-report",
    scale = 2,
    onProgress,
  } = options;

  if (!element) throw new Error("No .print-area element found on page.");

  const startTime = Date.now();

  // Create a timeout promise that rejects after PDF_TIMEOUT_MS
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new PdfTimeoutError("PDF export exceeded 60s timeout"));
    }, PDF_TIMEOUT_MS);
  });

  try {
    addDiagnosticBreadcrumb("pdf:export:start", { filename, scale });
    onProgress?.("loading-libs");

    // Dynamic imports keep these large libs out of the initial bundle.
    // Race against timeout to ensure we abort if loading takes too long.
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.race([
      Promise.all([import("html2canvas"), import("jspdf")]),
      timeoutPromise,
    ]);

    addDiagnosticBreadcrumb("pdf:export:rendering-canvas");
    onProgress?.("rendering-canvas");

    // Race canvas rendering against timeout
    const canvas = await Promise.race([
      html2canvas(element, {
        scale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        onclone(clonedDoc) {
          clonedDoc.querySelectorAll<HTMLElement>(".no-print").forEach((el) => {
            el.style.display = "none";
          });
          clonedDoc.body.style.background = "#ffffff";
        },
      }),
      timeoutPromise,
    ]);

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const imgWidthPx = canvas.width;
    const imgHeightPx = canvas.height;

    // Estimate memory usage (rough: canvas data + PDF overhead)
    const estimatedMemoryMb = (imgData.length / (1024 * 1024)) * 1.5;
    if (estimatedMemoryMb > 100) {
      throw new Error(
        `PDF too large (${estimatedMemoryMb.toFixed(0)}MB). Try reducing content or splitting into multiple reports.`,
      );
    }

    const pxPerMm = imgWidthPx / A4_WIDTH_MM;
    const imgHeightMm = imgHeightPx / pxPerMm;

    addDiagnosticBreadcrumb("pdf:export:generating-pdf", {
      pages: Math.ceil(imgHeightMm / A4_HEIGHT_MM),
      memoryMb: estimatedMemoryMb.toFixed(1),
    });
    onProgress?.("generating-pdf");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    let yOffset = 0;
    let page = 0;

    while (yOffset < imgHeightMm) {
      if (page > 0) pdf.addPage();

      pdf.addImage(imgData, "JPEG", 0, -yOffset, A4_WIDTH_MM, imgHeightMm);

      yOffset += A4_HEIGHT_MM;
      page++;
    }

    pdf.save(`${filename}.pdf`);

    const durationMs = Date.now() - startTime;
    addDiagnosticBreadcrumb("pdf:export:complete", {
      filename,
      pages: page,
      durationMs,
    });
    onProgress?.("complete");
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg =
      err instanceof PdfTimeoutError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);

    logger.error("[pdf] export failed", {
      filename,
      durationMs,
      error: errorMsg,
    });

    addDiagnosticBreadcrumb("pdf:export:error", {
      filename,
      durationMs,
      error: errorMsg,
    });

    throw err;
  } finally {
    // Clear timeout to avoid unnecessary timer execution
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}
