export type CapturedElementImage = {
  dataUrl: string;
  width: number;
  height: number;
};

export async function captureElementScreenshot(
  element: HTMLElement,
  scale = 2,
): Promise<CapturedElementImage> {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}
