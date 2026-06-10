import type { FeasibilityStudySnapshot } from "../domain";
import type { FeasibilityRepository } from "./ports";

export type ShareFeasibilityStudyCommand = {
  studyId: string;
};

export type ShareFeasibilityStudyDeps = {
  repository: FeasibilityRepository;
};

export function makeShareFeasibilityStudy({ repository }: ShareFeasibilityStudyDeps) {
  return async function shareFeasibilityStudy(
    command: ShareFeasibilityStudyCommand,
  ): Promise<FeasibilityStudySnapshot> {
    return repository.createStatusSnapshot(command.studyId, "shared");
  };
}
