export type CapturedElementImage = {
  dataUrl: string;
  width: number;
  height: number;
};

export async function captureElementScreenshot(
  element: HTMLElement,
  scale = 2,
): Promise<CapturedElementImage> {
  const [{ default: html2canvas }, { sanitizeClonedDocumentForPdf }] = await Promise.all([
    import("html2canvas"),
    import("@/lib/pdfSafeColors"),
  ]);
  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
    onclone(clonedDoc, clonedElement) {
      // IA-5-R3B: same oklch compatibility path as exportReportPdf.
      sanitizeClonedDocumentForPdf(clonedDoc, {
        sourceDoc: document,
        liveRoot: element,
        clonedRoot: clonedElement as HTMLElement,
      });
    },
  });

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}
