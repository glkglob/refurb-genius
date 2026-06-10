import type { RoiEngineInputs, RoiEngineResult } from "../domain";

export interface RoiEnginePort {
  run(inputs: RoiEngineInputs): RoiEngineResult;
}
