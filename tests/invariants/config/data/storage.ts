/**
 * Storage bucket inventory (from migrations + app constants).
 */
import type { DataEnforcement, ProductOwnerLabel } from "./types";

export type StorageBucketRecord = {
  id: string;
  public: boolean;
  owner: ProductOwnerLabel;
  purpose: string;
  accessSummary: string;
  enforcementStatus: DataEnforcement;
  /** Repo-local evidence paths (migrations or constants) */
  evidencePaths: string[];
  migrationEvidence: string;
};

export const STORAGE_BUCKETS: StorageBucketRecord[] = [
  {
    id: "project-photos",
    public: false,
    owner: "refurb-genius",
    purpose: "Project photos (+ deal opportunity photos reuse)",
    accessSummary: "Owner-scoped folder policies; signed retrieval",
    enforcementStatus: "enforced",
    evidencePaths: [
      "supabase/migrations/20260508155054_53140776-1cf3-48c6-b05a-c2238aa4068d.sql",
      "supabase/migrations/20260610120000_ensure_project_photos_bucket.sql",
      "supabase/migrations/20260816155524_project_photos_private.sql",
      "src/lib/photos-write.ts",
    ],
    migrationEvidence:
      "20260508155054_*, 20260610120000_ensure_project_photos_bucket.sql, 20260816155524_project_photos_private.sql",
  },
  {
    id: "floorplans",
    public: false,
    owner: "refurb-genius",
    purpose: "Private floorplan assets",
    accessSummary: "Owner-scoped folder policies",
    enforcementStatus: "enforced",
    evidencePaths: ["supabase/migrations/20260605123000_feature_foundation.sql"],
    migrationEvidence: "20260605123000_feature_foundation.sql",
  },
  {
    id: "pitch-decks",
    public: false,
    owner: "refurb-genius",
    purpose: "Private pitch deck exports",
    accessSummary: "Owner-scoped folder policies",
    enforcementStatus: "enforced",
    evidencePaths: [
      "supabase/migrations/20260605123000_feature_foundation.sql",
      "src/lib/pitchDeck.ts",
    ],
    migrationEvidence: "20260605123000_feature_foundation.sql",
  },
  {
    id: "gallery",
    public: true,
    owner: "refurb-genius",
    purpose: "Public gallery images",
    accessSummary: "Public read; owner write",
    enforcementStatus: "enforced",
    evidencePaths: ["supabase/migrations/20260605123000_feature_foundation.sql"],
    migrationEvidence: "20260605123000_feature_foundation.sql",
  },
];

/** Bucket IDs known from repo evidence (for drift detection). */
export const EVIDENCED_BUCKET_IDS = [
  "project-photos",
  "floorplans",
  "pitch-decks",
  "gallery",
] as const;
