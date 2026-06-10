/**
 * AI-design slice — Application ports.
 */
import type {
  GenerateRedesignInput,
  RedesignConcept,
  ScopeAnalysisInput,
  ScopeAnalysisResult,
} from "../domain";

export interface AiRedesignPort {
  generateConcepts(input: GenerateRedesignInput): Promise<RedesignConcept[]>;
}

export interface AiScopePort {
  analyzeScope(input: ScopeAnalysisInput): Promise<ScopeAnalysisResult>;
}

export type SaveScopeAnalysisCommand = {
  projectId: string;
  analysis: ScopeAnalysisResult;
  region: string;
  notes?: string;
};

export interface ScopeAnalysisRepository {
  save(command: SaveScopeAnalysisCommand): Promise<void>;
  loadLatest(projectId: string): Promise<ScopeAnalysisResult | null>;
}

export interface RedesignCachePort {
  get(projectId: string): RedesignConcept[] | undefined;
  set(projectId: string, concepts: RedesignConcept[]): void;
}
