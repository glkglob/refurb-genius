import type { RoiReport } from "../domain";
import { buildCashFlowModel, buildGdvBreakdown, type RoiEngineInputs } from "../domain";
import { makeCalculateInvestmentMetrics } from "./calculateInvestmentMetrics";
import { makeRunSensitivityAnalysis } from "./runSensitivityAnalysis";
import type { RoiEnginePort } from "./ports";

export type GenerateRoiReportCommand = {
  inputs: RoiEngineInputs;
  assumptions?: string[];
};

export type GenerateRoiReportDeps = {
  engine: RoiEnginePort;
};

export function makeGenerateRoiReport({ engine }: GenerateRoiReportDeps) {
  const calculateInvestmentMetrics = makeCalculateInvestmentMetrics({ engine });
  const runSensitivityAnalysis = makeRunSensitivityAnalysis({ engine });

  return async function generateRoiReport(command: GenerateRoiReportCommand): Promise<RoiReport> {
    const baseMetrics = await calculateInvestmentMetrics({ inputs: command.inputs });
    const scenarios = await runSensitivityAnalysis({ inputs: command.inputs });

    return {
      generatedAt: new Date().toISOString(),
      baseMetrics,
      gdv: buildGdvBreakdown(command.inputs, baseMetrics),
      cashFlow: buildCashFlowModel(command.inputs, baseMetrics),
      scenarios,
      assumptions: command.assumptions ?? [
        "Refurb budget is sourced from deterministic estimate totals when available.",
        "Holding costs are annualized and treated as deterministic inputs.",
        "Sensitivity scenarios adjust only GDV, refurb budget, and holding costs.",
      ],
    };
  };
}
