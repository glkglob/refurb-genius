/**
 * Types for the living Architecture Migration Register.
 */

export type MigrationCandidateStatus =
  | "Proposed"
  | "Planned"
  | "Selected"
  | "In Progress"
  | "Completed"
  | "Deferred"
  | "Cancelled"
  /** Objective remains valid; strategy moved to an architecture objective (e.g. AO-1). */
  | "Reclassified";

export type BlastRadiusTier = "T0" | "T1" | "T2" | "T3";

export type MigrationCandidate = {
  id: string;
  title: string;
  status: MigrationCandidateStatus;
  blastRadius: BlastRadiusTier;
  problem: string;
  currentOwner: string;
  targetOwner: string;
  /** Candidate IDs that should complete first */
  dependencies: string[];
  /** Candidate IDs that benefit after this one */
  dependents: string[];
  evidence: {
    commit?: string;
    productionImporters?: number;
    notes?: string;
  };
};

export type ArchitectureObjective = {
  id: string;
  title: string;
  status: "Active" | "Deferred" | "Completed";
  description: string;
  relatedCandidates: string[];
};
