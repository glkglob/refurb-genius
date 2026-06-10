import { validateShareLinkInput, type CreateShareLinkInput, type ShareLink } from "../domain";
import type { ShareLinkRepository } from "./ports";

export type CreateShareLinkDeps = {
  repository: ShareLinkRepository;
};

export function makeCreateShareLink({ repository }: CreateShareLinkDeps) {
  return async function createShareLink(input: CreateShareLinkInput): Promise<ShareLink> {
    validateShareLinkInput(input);
    return repository.create(input);
  };
}
