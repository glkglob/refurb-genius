import { runRoiEngine } from "@repo/services";
import type { RoiEnginePort } from "../../application";
import type { RoiEngineInputs, RoiEngineResult } from "../../domain";

export class DeterministicRoiEngineAdapter implements RoiEnginePort {
  run(inputs: RoiEngineInputs): RoiEngineResult {
    return runRoiEngine(inputs);
  }
}

export const deterministicRoiEngine: RoiEnginePort = new DeterministicRoiEngineAdapter();
