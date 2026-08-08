export type CapturedElementImage = {
  dataUrl: string;
  width: number;
  height: number;
};

export async function captureElementScreenshot(
  element: HTMLElement,
  scale = 2,
): Promise<CapturedElementImage> {
  const [
    { default: html2canvas },
    { sanitizeClonedDocumentForPdf, uninstallPdfSafeComputedStyleHook },
  ] = await Promise.all([import("html2canvas"), import("@/lib/pdfSafeColors")]);
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      onclone(clonedDoc, clonedElement) {
        // IA-5-R3B/R4B: same Color-4 (oklch/oklab/color-mix) compatibility path.
        sanitizeClonedDocumentForPdf(clonedDoc, {
          sourceDoc: document,
          liveRoot: element,
          clonedRoot: clonedElement as HTMLElement,
        });
      },
    });
  } finally {
    uninstallPdfSafeComputedStyleHook();
  }

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}
