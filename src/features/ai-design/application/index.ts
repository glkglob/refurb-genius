export {
  makeGenerateRedesign,
  type GenerateRedesignCommand,
  type GenerateRedesignDeps,
} from "./generateRedesign";
export {
  makeRunScopeAnalysis,
  type RunScopeAnalysisCommand,
  type RunScopeAnalysisDeps,
} from "./runScopeAnalysis";
export type {
  AiRedesignPort,
  AiScopePort,
  RedesignCachePort,
  SaveScopeAnalysisCommand,
  ScopeAnalysisRepository,
} from "./ports";
export {
  makeAiDesignService,
  type AiDesignService,
  type AiDesignServiceDeps,
} from "./aiDesignService";
