import type { ShareLinkRepository } from "./ports";

export type RevokeShareLinkDeps = {
  repository: ShareLinkRepository;
};

export function makeRevokeShareLink({ repository }: RevokeShareLinkDeps) {
  return async function revokeShareLink(linkId: string): Promise<void> {
    await repository.revoke(linkId);
  };
}
