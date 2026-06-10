import type { ExportMetadata, ExportReportRequest } from "./types";

export function isValidExportFilename(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{2,120}$/i.test(value);
}

export function isSupportedReportType(value: string): boolean {
  return value === "project-report" || value === "pitch-deck";
}

export function ensureValidExportRequest(request: ExportReportRequest): void {
  if (!isSupportedReportType(request.type)) {
    throw new Error(`Unsupported report type: ${request.type}`);
  }

  if (request.type === "project-report" && !isValidExportFilename(request.filename)) {
    throw new Error(`Invalid project report filename: ${request.filename}`);
  }

  if (request.type === "pitch-deck" && !isValidExportFilename(request.filenamePrefix)) {
    throw new Error(`Invalid pitch deck filename prefix: ${request.filenamePrefix}`);
  }
}

export function buildExportMetadata(input: {
  reportType: ExportMetadata["reportType"];
  projectId?: string;
}): ExportMetadata {
  return {
    reportType: input.reportType,
    format: "pdf",
    generatedAtIso: new Date().toISOString(),
    generatorVersion: "export-slice-v1",
    projectId: input.projectId,
  };
}
