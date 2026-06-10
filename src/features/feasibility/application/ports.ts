import type {
  Estimate,
  EstimateInputs,
  ExportReference,
  FeasibilityStatus,
  Project,
  RoiReport,
  RoomAnalysis,
  ScopeAnalysisInput,
  ScopeAnalysisResult,
} from "@repo/types";
import type { RoiEngineInputs } from "@/features/roi";
import type { FeasibilityStudy, FeasibilityStudySnapshot } from "../domain";

export interface FeasibilityRepository {
  saveSnapshot(study: FeasibilityStudy): Promise<FeasibilityStudySnapshot>;
  loadLatest(projectId: string): Promise<FeasibilityStudy | null>;
  loadByStudyId(studyId: string): Promise<FeasibilityStudy | null>;
  listByProject(projectId: string): Promise<FeasibilityStudySnapshot[]>;
  createStatusSnapshot(
    studyId: string,
    status: FeasibilityStatus,
  ): Promise<FeasibilityStudySnapshot>;
}

export interface PhotoAnalysisCapability {
  analyzePhotos(input: {
    projectId: string;
    photos: ScopeAnalysisInput["photos"];
  }): Promise<RoomAnalysis[]>;
}

export interface ScopeCapability {
  analyzeScope(input: ScopeAnalysisInput): Promise<ScopeAnalysisResult>;
  generateFromAnalysis(input: {
    projectId: string;
    photos: ScopeAnalysisInput["photos"];
    roomAnalyses: RoomAnalysis[];
    scopeInput: Omit<ScopeAnalysisInput, "projectId" | "photos">;
  }): Promise<ScopeAnalysisResult>;
}

export interface EstimateCapability {
  generateEstimate(input: EstimateInputs): Promise<Estimate>;
}

export interface RoiCapability {
  generateReport(input: RoiEngineInputs): Promise<RoiReport>;
}

export interface ExportCapability {
  listProjectExports(projectId: string): Promise<ExportReference[]>;
  queueFeasibilityReport(studyId: string): Promise<void>;
}

export type CreateFeasibilityStudyCommand = {
  projectId: string;
  property: Project;
  photos: ScopeAnalysisInput["photos"];
  scopeInput: Omit<ScopeAnalysisInput, "projectId" | "photos">;
  estimateInput: EstimateInputs;
  roiInput: Omit<RoiEngineInputs, "refurb_budget">;
};

export type OrchestrateFeasibilityResult = {
  studySnapshot: FeasibilityStudySnapshot;
  study: FeasibilityStudy;
  roomAnalyses: RoomAnalysis[];
  scope: ScopeAnalysisResult;
  estimate: Estimate;
  roi: RoiReport;
};
