import type { FeasibilityStudy } from "../domain";
import type { FeasibilityRepository } from "./ports";

export type LoadFeasibilityStudyQuery =
  | { projectId: string; studyId?: undefined }
  | { projectId?: undefined; studyId: string };

export type LoadFeasibilityStudyDeps = {
  repository: FeasibilityRepository;
};

export function makeLoadFeasibilityStudy({ repository }: LoadFeasibilityStudyDeps) {
  return async function loadFeasibilityStudy(
    query: LoadFeasibilityStudyQuery,
  ): Promise<FeasibilityStudy | null> {
    if (query.studyId) {
      return repository.loadByStudyId(query.studyId);
    }
    if (!query.projectId) {
      throw new Error("projectId is required when studyId is not provided.");
    }
    return repository.loadLatest(query.projectId);
  };
}
