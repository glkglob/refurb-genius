/**
 * IA-5-R3B — exportReportPdf wires clone-only colour sanitisation into html2canvas.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const html2canvasMock = vi.fn();
const jsPdfSave = vi.fn();
const jsPdfAddImage = vi.fn();
const jsPdfAddPage = vi.fn();

vi.mock("html2canvas", () => ({
  default: (...args: unknown[]) => html2canvasMock(...args),
}));

vi.mock("jspdf", () => ({
  default: class JsPDFMock {
    addImage = jsPdfAddImage;
    addPage = jsPdfAddPage;
    save = jsPdfSave;
  },
}));

vi.mock("./sentry", () => ({
  addDiagnosticBreadcrumb: vi.fn(),
}));

vi.mock("./logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const sanitizeMock = vi.fn();
vi.mock("./pdfSafeColors", () => ({
  sanitizeClonedDocumentForPdf: (...args: unknown[]) => sanitizeMock(...args),
  uninstallPdfSafeComputedStyleHook: vi.fn(),
  forcePdfSafeDocumentChrome: vi.fn(),
  installPdfSafeComputedStyleHook: vi.fn(),
}));

describe("exportReportPdf oklch compatibility wiring", () => {
  beforeEach(() => {
    html2canvasMock.mockReset();
    sanitizeMock.mockReset();
    jsPdfSave.mockReset();
    jsPdfAddImage.mockReset();
    jsPdfAddPage.mockReset();

    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 600;
    // jsdom canvas may not implement toDataURL fully — stub.
    canvas.toDataURL = vi.fn(() => "data:image/jpeg;base64,AAAA") as typeof canvas.toDataURL;

    html2canvasMock.mockImplementation(
      async (_el: HTMLElement, opts?: { onclone?: (doc: Document, el: HTMLElement) => void }) => {
        const clonedDoc = document.implementation.createHTMLDocument("clone");
        const clonedRoot = clonedDoc.createElement("div");
        clonedRoot.className = "print-area";
        clonedDoc.body.appendChild(clonedRoot);
        opts?.onclone?.(clonedDoc, clonedRoot);
        return canvas;
      },
    );
  });

  it("invokes sanitizeClonedDocumentForPdf inside html2canvas onclone", async () => {
    const root = document.createElement("div");
    root.className = "print-area";
    root.textContent = "Report";
    document.body.appendChild(root);

    const { exportReportPdf } = await import("./exportPdf");
    await exportReportPdf({ element: root, filename: "test-report" });

    expect(html2canvasMock).toHaveBeenCalledTimes(1);
    expect(sanitizeMock).toHaveBeenCalledTimes(1);
    const [clonedDoc, options] = sanitizeMock.mock.calls[0] as [
      Document,
      { liveRoot: HTMLElement; clonedRoot: HTMLElement },
    ];
    expect(clonedDoc).toBeTruthy();
    expect(options.liveRoot).toBe(root);
    expect(options.clonedRoot).toBeTruthy();
    expect(jsPdfSave).toHaveBeenCalledWith("test-report.pdf");

    root.remove();
  });

  it("does not swallow renderer errors (failure settles to caller)", async () => {
    html2canvasMock.mockRejectedValue(
      new Error('Attempting to parse an unsupported color function "oklch"'),
    );
    const root = document.createElement("div");
    root.className = "print-area";
    document.body.appendChild(root);

    const { exportReportPdf } = await import("./exportPdf");
    await expect(exportReportPdf({ element: root })).rejects.toThrow(/oklch/i);
    expect(jsPdfSave).not.toHaveBeenCalled();

    root.remove();
  });

  it("IA-5-R4B: oklab renderer failures also settle without PDF save", async () => {
    html2canvasMock.mockRejectedValue(
      new Error('Attempting to parse an unsupported color function "oklab"'),
    );
    const root = document.createElement("div");
    root.className = "print-area";
    document.body.appendChild(root);

    const { exportReportPdf } = await import("./exportPdf");
    await expect(exportReportPdf({ element: root })).rejects.toThrow(/oklab/i);
    expect(jsPdfSave).not.toHaveBeenCalled();

    root.remove();
  });
});
