import type { CreateShareLinkInput, ShareLink } from "../domain";

export interface ShareLinkRepository {
  create(input: CreateShareLinkInput): Promise<ShareLink>;
  listByStudy(studyId: string): Promise<ShareLink[]>;
  revoke(linkId: string): Promise<void>;
}
