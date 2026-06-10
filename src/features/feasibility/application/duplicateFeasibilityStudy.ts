import type { FeasibilityStudySnapshot } from "../domain";
import type { FeasibilityRepository } from "./ports";

export type DuplicateFeasibilityStudyCommand = {
  studyId: string;
};

export type DuplicateFeasibilityStudyDeps = {
  repository: FeasibilityRepository;
};

export function makeDuplicateFeasibilityStudy({ repository }: DuplicateFeasibilityStudyDeps) {
  return async function duplicateFeasibilityStudy(
    command: DuplicateFeasibilityStudyCommand,
  ): Promise<FeasibilityStudySnapshot> {
    const existing = await repository.loadByStudyId(command.studyId);
    if (!existing) throw new Error(`Feasibility study not found: ${command.studyId}`);

    const now = new Date();
    const duplicate = {
      ...existing,
      id: crypto.randomUUID(),
      status: "draft" as const,
      metadata: {
        version: 1,
        lastComputedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };

    return repository.saveSnapshot(duplicate);
  };
}
