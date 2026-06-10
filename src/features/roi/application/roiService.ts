import type { RoiReport, RoiEngineResult, SensitivityScenario } from "../domain";
import type { RoiEngineInputs } from "../domain";
import {
  makeCalculateInvestmentMetrics,
  type CalculateInvestmentMetricsCommand,
} from "./calculateInvestmentMetrics";
import { makeGenerateRoiReport, type GenerateRoiReportCommand } from "./generateRoiReport";
import {
  makeRunSensitivityAnalysis,
  type RunSensitivityAnalysisCommand,
} from "./runSensitivityAnalysis";
import type { RoiEnginePort } from "./ports";

export interface RoiService {
  calculateInvestmentMetrics(command: CalculateInvestmentMetricsCommand): Promise<RoiEngineResult>;
  runSensitivityAnalysis(command: RunSensitivityAnalysisCommand): Promise<SensitivityScenario[]>;
  generateRoiReport(command: GenerateRoiReportCommand): Promise<RoiReport>;
  generateFromEstimate(command: {
    inputs: Omit<RoiEngineInputs, "refurb_budget">;
    refurbBudget: number;
  }): Promise<RoiReport>;
}

export type RoiServiceDeps = {
  engine: RoiEnginePort;
};

export function makeRoiService({ engine }: RoiServiceDeps): RoiService {
  const calculateInvestmentMetrics = makeCalculateInvestmentMetrics({ engine });
  const runSensitivityAnalysis = makeRunSensitivityAnalysis({ engine });
  const generateRoiReport = makeGenerateRoiReport({ engine });

  return {
    calculateInvestmentMetrics,
    runSensitivityAnalysis,
    generateRoiReport,
    async generateFromEstimate(command) {
      return generateRoiReport({
        inputs: {
          ...command.inputs,
          refurb_budget: command.refurbBudget,
        },
      });
    },
  };
}
