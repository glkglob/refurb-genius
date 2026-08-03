// Photo Analysis Results domain types + analysis_data mapping (P1B2)

export type PhotoAnalysisResult = {
  id: string;
  projectId: string;
  photoId: string | null;
  userId: string;
  analysisData: Record<string, unknown>; // e.g. { materials: string[], condition: string, dimensions: {...}, issues: [...] }
  confidence: number | null;
  source: string; // "ai" | "fallback" | ...
  createdAt: string;
  updatedAt: string;
};

export {
  parsePhotoAnalysisContent,
  serializePhotoAnalysisContent,
  mapPhotoAnalysisRow,
  createPhotoAnalysisAppModel,
  EMPTY_PHOTO_ANALYSIS_CONTENT,
  type PhotoAnalysisAppModel,
  type PhotoAnalysisContent,
  type PhotoAnalysisDefect,
  type PhotoAnalysisMaterial,
  type PhotoAnalysisCostSuggestions,
  type PhotoAnalysisDbRowLike,
  type PhotoAnalysisJson,
} from "./photo-analysis-content";
