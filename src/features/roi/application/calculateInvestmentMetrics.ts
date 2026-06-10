import type { RoiEngineInputs, RoiEngineResult } from "../domain";
import type { RoiEnginePort } from "./ports";

export type CalculateInvestmentMetricsCommand = {
  inputs: RoiEngineInputs;
};

export type CalculateInvestmentMetricsDeps = {
  engine: RoiEnginePort;
};

export function makeCalculateInvestmentMetrics({ engine }: CalculateInvestmentMetricsDeps) {
  return async function calculateInvestmentMetrics(
    command: CalculateInvestmentMetricsCommand,
  ): Promise<RoiEngineResult> {
    return engine.run(command.inputs);
  };
}
