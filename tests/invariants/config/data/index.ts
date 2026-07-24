/**
 * Data Architecture Registry — Phase 4–5 public barrel.
 * Registration + integrity ratchets only: no schema, RLS, or runtime changes.
 *
 * @see docs/architecture/overview.md
 * @see docs/architecture/phase-0-inventory-report.md
 */

import { DATA_DOMAINS } from "./domains";
import { PUBLIC_TABLES, DB_FUNCTIONS } from "./database-inventory";
import { STORAGE_BUCKETS } from "./storage";
import { MIGRATION_FILENAMES } from "./migrations";

export * from "./types";
export * from "./domains";
export * from "./persistence";
export * from "./tenancy";
export * from "./database-inventory";
export * from "./storage";
export * from "./migrations";
export * from "./services";
export * from "./lineage";
export * from "./security";

export const DATA_REGISTRY_META = {
  phase: 5,
  purpose: "data-governance-integrity-and-narrow-ratchets",
  lastUpdated: "2026-07-24",
  owner: "platform architecture",
  schemaSourceOfTruth: "packages/supabase/src/database.types.ts",
  migrationsSourceOfTruth: "supabase/migrations/",
  policySourceOfTruth: "docs/architecture/overview.md",
  /** No organisation multi-tenancy in public schema today */
  orgTenancyPresent: false,
} as const;

/** Build a deterministic summary for invariant logging / reports. */
export function summarizeDataRegistry(diskMigrationCount?: number): string {
  const persistent = DATA_DOMAINS.filter((d) => d.persistenceKind === "persistent").length;
  const partial =
    DATA_DOMAINS.filter((d) => d.enforcementStatus === "partial").length +
    PUBLIC_TABLES.filter((t) => t.enforcementStatus === "partial").length;
  const transitional = DATA_DOMAINS.filter((d) => d.enforcementStatus === "transitional").length;
  const lines = [
    "Data Architecture Registry",
    "",
    `Domains: ${DATA_DOMAINS.length}`,
    `Tables: ${PUBLIC_TABLES.length}`,
    `Storage buckets: ${STORAGE_BUCKETS.length}`,
    `Functions: ${DB_FUNCTIONS.length}`,
    `Triggers: not fully inventoried (partial coverage)`,
    `Persistent domains: ${persistent}`,
    `Partial controls (domain+table flags): ${partial}`,
    `Transitional domain controls: ${transitional}`,
    `Unresolved ownership fields: 0 required fields empty (PM tracking not claimed)`,
    `Migrations on disk: ${diskMigrationCount ?? MIGRATION_FILENAMES.length}`,
    `Org tenancy present: ${DATA_REGISTRY_META.orgTenancyPresent}`,
  ];
  return lines.join("\n");
}
