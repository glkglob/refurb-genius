/**
 * AI-design slice — Application service.
 */
import { makeGenerateRedesign, type GenerateRedesignCommand } from "./generateRedesign";
import { makeRunScopeAnalysis, type RunScopeAnalysisCommand } from "./runScopeAnalysis";
import type { RedesignConcept, ScopeAnalysisResult } from "../domain";
import type {
  AiRedesignPort,
  AiScopePort,
  RedesignCachePort,
  SaveScopeAnalysisCommand,
  ScopeAnalysisRepository,
} from "./ports";

export interface AiDesignService {
  generateRedesign(command: GenerateRedesignCommand): Promise<RedesignConcept[]>;
  runScopeAnalysis(command: RunScopeAnalysisCommand): Promise<ScopeAnalysisResult>;
  saveScopeAnalysis(command: SaveScopeAnalysisCommand): Promise<void>;
  loadSavedScopeAnalysis(projectId: string): Promise<ScopeAnalysisResult | null>;
}

export type AiDesignServiceDeps = {
  redesign: AiRedesignPort;
  scope: AiScopePort;
  scopeAnalyses?: ScopeAnalysisRepository;
  redesignCache?: RedesignCachePort;
};

export function makeAiDesignService(deps: AiDesignServiceDeps): AiDesignService {
  const generateRedesign = makeGenerateRedesign({
    redesign: deps.redesign,
    cache: deps.redesignCache,
  });
  const runScopeAnalysis = makeRunScopeAnalysis({ scope: deps.scope });

  return {
    generateRedesign,
    runScopeAnalysis,
    saveScopeAnalysis: async (command) => {
      if (!deps.scopeAnalyses) {
        throw new Error("Scope persistence is not configured.");
      }
      await deps.scopeAnalyses.save(command);
    },
    loadSavedScopeAnalysis: async (projectId) => {
      if (!deps.scopeAnalyses) return null;
      return deps.scopeAnalyses.loadLatest(projectId);
    },
  };
}
