// Photo Analysis Results domain types

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
