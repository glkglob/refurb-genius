import type { FeasibilityStudySnapshot } from "../domain";
import type { FeasibilityRepository } from "./ports";

export type ArchiveFeasibilityStudyCommand = {
  studyId: string;
};

export type ArchiveFeasibilityStudyDeps = {
  repository: FeasibilityRepository;
};

export function makeArchiveFeasibilityStudy({ repository }: ArchiveFeasibilityStudyDeps) {
  return async function archiveFeasibilityStudy(
    command: ArchiveFeasibilityStudyCommand,
  ): Promise<FeasibilityStudySnapshot> {
    return repository.createStatusSnapshot(command.studyId, "archived");
  };
}
