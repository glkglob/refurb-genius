/**
 * Architecture registry — Phase 2 registration + Phase 3 structured baselines.
 *
 * @see docs/architecture/overview.md
 * @see docs/architecture/phase-0-inventory-report.md
 * @see docs/architecture/adr/0001-adopt-rules-first-incremental-architecture-governance.md
 */

export * from "./types";
export * from "./architecture-areas";
export * from "./ownership";
export * from "./dependencies";
export * from "./transitional-layers";
export * from "./ai-boundaries";
export * from "./exceptions";
export * from "./enforcement-inventory";
export * from "./frozen-path-allowlists";
export * from "./legacy-import-baseline";
export * as data from "./data/index";

export const REGISTRY_META = {
  phase: 5,
  purpose: "architecture-registry-plus-data-integrity-ratchets",
  lastUpdated: "2026-07-24",
  owner: "platform architecture",
  governingSequence: "document → register → enforce → baseline → migrate",
  /** Exact freeze path sets (consumed by legacy-layer-freeze invariant) */
  freezeSourceOfTruth: "tests/invariants/config/frozen-path-allowlists.ts",
  /** Exact legacy import edges (consumed by no-legacy-imports invariant) */
  legacyImportBaselineSourceOfTruth: "tests/invariants/config/legacy-import-baseline.ts",
  /** Data ownership / tenancy + integrity ratchets (Phase 4–5) */
  dataRegistry: "tests/invariants/config/data/",
  policySourceOfTruth: "docs/architecture/overview.md",
  evidenceSourceOfTruth: "docs/architecture/phase-0-inventory-report.md",
} as const;
