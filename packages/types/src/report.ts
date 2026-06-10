// Report — composite shape consumed by the report preview / PDF export.
import type { Project } from "./project";
import type { Photo } from "./photo";
import type { AnalysisResult } from "./analysis";
import type { RedesignConcept } from "./redesign";
import type { Estimate } from "./estimate";
import type { InvestmentMetrics } from "./metrics";

export type Report = {
  project: Project;
  photos: Photo[];
  analysis: AnalysisResult[];
  concepts: RedesignConcept[];
  estimate: Estimate;
  metrics: InvestmentMetrics;
  generated_at: string;
};

export type ReportMetadata = {
  generated_at: string;
  project_id: string;
  exported_by_user_id?: string;
  version?: string;
};
