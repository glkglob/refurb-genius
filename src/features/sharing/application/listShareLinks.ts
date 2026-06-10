import type { ShareLink } from "../domain";
import type { ShareLinkRepository } from "./ports";

export type ListShareLinksDeps = {
  repository: ShareLinkRepository;
};

export function makeListShareLinks({ repository }: ListShareLinksDeps) {
  return async function listShareLinks(studyId: string): Promise<ShareLink[]> {
    return repository.listByStudy(studyId);
  };
}
