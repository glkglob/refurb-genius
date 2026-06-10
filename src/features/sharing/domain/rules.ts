import type { CreateShareLinkInput } from "./types";

export function validateShareLinkInput(input: CreateShareLinkInput): void {
  if (!input.studyId) {
    throw new Error("studyId is required to create a share link.");
  }

  if (input.expiresAt) {
    const date = new Date(input.expiresAt);
    if (Number.isNaN(date.getTime())) {
      throw new Error("expiresAt must be a valid ISO date string.");
    }
  }
}
