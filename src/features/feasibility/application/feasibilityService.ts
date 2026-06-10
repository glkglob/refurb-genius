import type { FeasibilityStudy, FeasibilityStudySnapshot } from "../domain";
import {
  makeCreateFeasibilityStudy,
  type CreateFeasibilityStudyDeps,
} from "./createFeasibilityStudy";
import {
  makeOrchestrateFeasibility,
  type OrchestrateFeasibilityDeps,
} from "./orchestrateFeasibility";
import {
  makeLoadFeasibilityStudy,
  type LoadFeasibilityStudyDeps,
  type LoadFeasibilityStudyQuery,
} from "./loadFeasibilityStudy";
import {
  makeShareFeasibilityStudy,
  type ShareFeasibilityStudyCommand,
  type ShareFeasibilityStudyDeps,
} from "./shareFeasibilityStudy";
import {
  makeArchiveFeasibilityStudy,
  type ArchiveFeasibilityStudyCommand,
} from "./archiveFeasibilityStudy";
import {
  makeDuplicateFeasibilityStudy,
  type DuplicateFeasibilityStudyCommand,
} from "./duplicateFeasibilityStudy";
import {
  makeQueueFeasibilityExport,
  type QueueFeasibilityExportCommand,
} from "./queueFeasibilityExport";
import type { CreateFeasibilityStudyCommand, FeasibilityRepository } from "./ports";
import type { OrchestrateFeasibilityResult } from "./ports";

export interface FeasibilityService {
  create(command: CreateFeasibilityStudyCommand): Promise<FeasibilityStudySnapshot>;
  orchestrate(command: CreateFeasibilityStudyCommand): Promise<OrchestrateFeasibilityResult>;
  load(query: LoadFeasibilityStudyQuery): Promise<FeasibilityStudy | null>;
  share(command: ShareFeasibilityStudyCommand): Promise<FeasibilityStudySnapshot>;
  archive(command: ArchiveFeasibilityStudyCommand): Promise<FeasibilityStudySnapshot>;
  duplicate(command: DuplicateFeasibilityStudyCommand): Promise<FeasibilityStudySnapshot>;
  queueExport(command: QueueFeasibilityExportCommand): Promise<void>;
  list(projectId: string): Promise<FeasibilityStudySnapshot[]>;
}

export type FeasibilityServiceDeps = CreateFeasibilityStudyDeps &
  OrchestrateFeasibilityDeps &
  LoadFeasibilityStudyDeps &
  ShareFeasibilityStudyDeps & {
    repository: FeasibilityRepository;
  };

export function makeFeasibilityService(deps: FeasibilityServiceDeps): FeasibilityService {
  const create = makeCreateFeasibilityStudy(deps);
  const orchestrate = makeOrchestrateFeasibility(deps);
  const load = makeLoadFeasibilityStudy(deps);
  const share = makeShareFeasibilityStudy(deps);
  const archive = makeArchiveFeasibilityStudy(deps);
  const duplicate = makeDuplicateFeasibilityStudy(deps);
  const queueExport = makeQueueFeasibilityExport(deps);

  return {
    create,
    orchestrate,
    load,
    share,
    archive,
    duplicate,
    queueExport,
    list(projectId: string) {
      return deps.repository.listByProject(projectId);
    },
  };
}
