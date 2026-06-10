import type { SensitivityScenario, SensitivityScenarioAssumptions } from "../domain";
import { applySensitivityToInputs, type RoiEngineInputs } from "../domain";
import type { RoiEnginePort } from "./ports";

export type RunSensitivityAnalysisCommand = {
  inputs: RoiEngineInputs;
  scenarios?: Array<{
    name: string;
    assumptions: SensitivityScenarioAssumptions;
  }>;
};

export type RunSensitivityAnalysisDeps = {
  engine: RoiEnginePort;
};

const DEFAULT_SCENARIOS: RunSensitivityAnalysisCommand["scenarios"] = [
  {
    name: "Conservative downside",
    assumptions: {
      gdvDeltaPercent: -7.5,
      refurbDeltaPercent: 10,
      holdingCostDeltaPercent: 8,
    },
  },
  {
    name: "Base case",
    assumptions: {
      gdvDeltaPercent: 0,
      refurbDeltaPercent: 0,
      holdingCostDeltaPercent: 0,
    },
  },
  {
    name: "Optimistic upside",
    assumptions: {
      gdvDeltaPercent: 6,
      refurbDeltaPercent: -4,
      holdingCostDeltaPercent: -6,
    },
  },
];

export function makeRunSensitivityAnalysis({ engine }: RunSensitivityAnalysisDeps) {
  return async function runSensitivityAnalysis(
    command: RunSensitivityAnalysisCommand,
  ): Promise<SensitivityScenario[]> {
    const scenarios = command.scenarios ?? DEFAULT_SCENARIOS ?? [];

    return scenarios.map((scenario) => {
      const modelInputs = applySensitivityToInputs(command.inputs, scenario.assumptions);
      return {
        name: scenario.name,
        assumptions: scenario.assumptions,
        metrics: engine.run(modelInputs),
      };
    });
  };
}
