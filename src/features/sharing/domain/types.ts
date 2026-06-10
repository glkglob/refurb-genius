import type { ShareAccessRole, ShareLink, ShareVisibility } from "@repo/types";

export type { ShareLink, ShareVisibility, ShareAccessRole };

export type CreateShareLinkInput = {
  studyId: string;
  visibility: ShareVisibility;
  accessRole: ShareAccessRole;
  expiresAt?: string | null;
};
