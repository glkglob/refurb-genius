/**
 * Migration ownership + explicit filename inventory (Phase 5).
 * Inventory only — does not parse SQL semantics.
 */
import type { DataEnforcement } from "./types";

export type MigrationPolicy = {
  location: string;
  owner: string;
  reviewCadence: string;
  enforcementStatus: DataEnforcement;
  rules: string[];
  migrationCountNote: string;
};

export const MIGRATION_POLICY: MigrationPolicy = {
  location: "supabase/migrations/",
  owner: "shared-platform (schema) with domain review for product tables",
  reviewCadence: "On every schema PR; security migrations require platform review",
  enforcementStatus: "documented",
  rules: [
    "Do not rewrite deployed migration history without an explicit plan",
    "Product-specific tables should name owners in PR architecture impact (Phase 3b deferred)",
    "RLS required for new user data tables",
    "Storage bucket changes need storage policy review",
    "Service role usage forbidden in client bundles (auth-env invariant)",
    "New migration files require refresh of MIGRATION_FILENAMES inventory",
  ],
  migrationCountNote:
    "Snapshot of migration filenames at Phase 5; integrity test compares to disk.",
};

/**
 * Exact migration basenames under supabase/migrations (sorted).
 * New files fail the data-registry invariant until this list is updated.
 */
export const MIGRATION_FILENAMES = [
  "20260508155054_53140776-1cf3-48c6-b05a-c2238aa4068d.sql",
  "20260508155119_78e67156-2bf7-44dd-9a2b-7a3b51986e33.sql",
  "20260513093000_admin-role-system.sql",
  "20260513140000_trades_job_interests.sql",
  "20260514120000_deal-opportunities.sql",
  "20260514130000_trades_jobs.sql",
  "20260514130001_trades_job_interests.sql",
  "20260514140000_trades_job_interests.sql",
  "20260514150000_trade_profiles.sql",
  "20260514160000_trades_job_interests_update_policy.sql",
  "20260523000000_room_analyses.sql",
  "20260523100000_evolve_estimates_schema.sql",
  "20260524000000_add_source_to_room_analyses.sql",
  "20260524100000_create_analysis_jobs.sql",
  "20260525120000_add_missing_project_columns.sql",
  "20260604140000_fix_is_admin_anon_permission.sql",
  "20260605123000_feature_foundation.sql",
  "20260610120000_ensure_project_photos_bucket.sql",
  "20260610121000_fix_storage_policy_function_grants.sql",
  "20260610122000_converge_public_gallery_projects.sql",
  "20260610130000_feasibility_studies_foundation.sql",
  "20260611120000_opportunity_photos.sql",
  "20260611125925_remote_sync.sql",
  "20260611130000_deal_threads.sql",
  "20260611130229_remote_sync.sql",
  "20260611140000_deal_chat_images.sql",
  "20260611150000_deal_opportunities_write_policy.sql",
  "20260721230000_p0_security_rls_hardening.sql",
  "20260724000000_profile_company_from_signup_metadata.sql",
] as const;

export const MIGRATION_TIMESTAMP_PATTERN = /^\d{14}_[\w-]+\.sql$/;

/** High-signal migration clusters (not exhaustive). */
export const MIGRATION_CLUSTERS = [
  {
    id: "core-schema",
    glob: "20260508155054*",
    purpose: "profiles, projects, photos, estimates, redesign, storage bootstrap",
  },
  {
    id: "admin-role",
    glob: "20260513093000*",
    purpose: "admin role + is_admin + admin select policies",
  },
  { id: "trades", glob: "2026051413*", purpose: "trades jobs, interests, profiles" },
  {
    id: "deal-copilot",
    glob: "20260514120000*|202606111*",
    purpose: "deal opportunities, threads, messages, opportunity photos",
  },
  {
    id: "feature-foundation",
    glob: "20260605123000*",
    purpose: "broader feature tables + buckets",
  },
  {
    id: "feasibility",
    glob: "20260610130000*",
    purpose: "feasibility studies, snapshots, exports, share links",
  },
  {
    id: "gallery-converge",
    glob: "20260610122000*",
    purpose: "public gallery projects convergence",
  },
  {
    id: "security-hardening",
    glob: "20260721230000*",
    purpose: "role escalation block, share RPC, trade message policies",
  },
  {
    id: "profile-company",
    glob: "20260724000000*",
    purpose: "map signup company metadata into profiles.company",
  },
] as const;
