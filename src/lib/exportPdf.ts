// PDF export helper.
//
// Captures the given HTML element as a series of A4 canvas pages and saves
// as a downloadable PDF. Uses html2canvas for DOM capture and jspdf for PDF
// assembly. Cross-origin images (e.g. Supabase Storage) are requested with
// useCORS: true — the Storage bucket must allow the app origin (which it does
// for the public `project-photos` bucket).
//
// This module is async-imported only when the user clicks "Export PDF" so
// html2canvas + jspdf are not part of the main bundle.

export type ExportPdfOptions = {
  /** Element to capture. Defaults to `document.querySelector('.print-area')`. */
  element?: HTMLElement | null;
  /** Filename without extension. Defaults to "refurb-genius-report". */
  filename?: string;
  /** Scale factor for the canvas (higher = crisper). Defaults to 2. */
  scale?: number;
};

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

export async function exportReportPdf(options: ExportPdfOptions = {}): Promise<void> {
  const {
    element = document.querySelector<HTMLElement>(".print-area"),
    filename = "refurb-genius-report",
    scale = 2,
  } = options;

  if (!element) throw new Error("No .print-area element found on page.");

  // Dynamic imports keep these large libs out of the initial bundle.
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#ffffff",
    // Temporarily remove sticky positioning so toolbar doesn't appear.
    onclone(clonedDoc) {
      clonedDoc.querySelectorAll<HTMLElement>(".no-print").forEach((el) => {
        el.style.display = "none";
      });
      // Ensure the cloned body background is white.
      clonedDoc.body.style.background = "#ffffff";
    },
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const imgWidthPx = canvas.width;
  const imgHeightPx = canvas.height;

  // Scale canvas pixels to mm at A4 width.
  const pxPerMm = imgWidthPx / A4_WIDTH_MM;
  const imgHeightMm = imgHeightPx / pxPerMm;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  let yOffset = 0;
  let page = 0;

  while (yOffset < imgHeightMm) {
    if (page > 0) pdf.addPage();

    // Map the current slice of the image onto the page.
    pdf.addImage(
      imgData,
      "JPEG",
      0, // x
      -yOffset, // y (negative to shift up)
      A4_WIDTH_MM,
      imgHeightMm,
    );

    yOffset += A4_HEIGHT_MM;
    page++;
  }

  pdf.save(`${filename}.pdf`);
}
