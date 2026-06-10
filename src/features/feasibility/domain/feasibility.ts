import type {
  Estimate,
  ExportReference,
  FeasibilityStatus,
  Project,
  RoiReport,
  RoomAnalysis,
  ScopeAnalysisResult,
} from "@repo/types";

export type StudyStatus = FeasibilityStatus;

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
  metadata: { version: number; lastComputedAt: Date };
  createdAt: Date;
  updatedAt: Date;
};

export type FeasibilityStudySnapshot = {
  studyId: string;
  projectId: string;
  version: number;
  capturedAt: Date;
  study: FeasibilityStudy;
};
