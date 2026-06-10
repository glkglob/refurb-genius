import type { RoomAnalysis, ScopeAnalysisResult } from "./ai";
import type { Estimate } from "./estimate";
import type { Project } from "./project";
import type { RoiReport } from "./roi";

export type FeasibilityStatus = "draft" | "complete" | "shared" | "archived";

export type ExportReference = {
  type: "project-report" | "pitch-deck" | "feasibility-study";
  filename: string;
  storagePath?: string;
  generatedAt: string;
};

export type FeasibilityStudy = {
  id: string;
  projectId: string;
  property: Project;
  roomAnalyses: RoomAnalysis[];
  scope: ScopeAnalysisResult;
  estimate: Estimate;
  roi: RoiReport;
  exports: ExportReference[];
  status: FeasibilityStatus;
  metadata: {
    version: number;
    lastComputedAt: string;
  };
  createdAt: string;
  updatedAt: string;
};
