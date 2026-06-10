export type ShareVisibility = "private" | "public";
export type ShareAccessRole = "investor" | "lender" | "jv";

export type ShareLink = {
  id: string;
  studyId: string;
  token: string;
  visibility: ShareVisibility;
  accessRole: ShareAccessRole;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};
