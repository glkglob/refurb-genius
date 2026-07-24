/**
 * Persistent data domains verified from packages/supabase database.types + app usage.
 */
import type {
  DataEnforcement,
  DataMaturity,
  PersistenceKind,
  ProductOwnerLabel,
  TenantScope,
} from "./types";

export type DataDomain = {
  id: string;
  label: string;
  owner: ProductOwnerLabel;
  /** Tables / storage that form this domain */
  tables: string[];
  storageBuckets?: string[];
  sourceOfTruth: string;
  persistenceLayer: string;
  tenantScope: TenantScope;
  lifecycle: string;
  maturity: DataMaturity;
  enforcementStatus: DataEnforcement;
  /** Durability classification (Phase 5) */
  persistenceKind: PersistenceKind;
  /** When enforcementStatus is enforced, name at least one invariant or migration evidence */
  enforcementEvidence?: string[];
  notes?: string;
};

export const DATA_DOMAINS: DataDomain[] = [
  {
    id: "identity-profiles",
    label: "Identity & profiles",
    owner: "shared-platform",
    tables: ["profiles"],
    sourceOfTruth: "public.profiles (+ auth.users via Supabase Auth)",
    persistenceLayer: "Supabase Postgres + Auth",
    tenantScope: "authenticated-user",
    lifecycle: "Created by handle_new_user on signup; user-updatable own row; role protected",
    maturity: "live",
    enforcementStatus: "enforced",
    persistenceKind: "persistent",
    enforcementEvidence: [
      "supabase/migrations/20260508155054_53140776-1cf3-48c6-b05a-c2238aa4068d.sql",
      "supabase/migrations/20260721230000_p0_security_rls_hardening.sql",
    ],
    notes: "RLS own-row + admin select; prevent_role_self_escalation trigger.",
  },
  {
    id: "projects",
    label: "Projects",
    owner: "refurb-genius",
    tables: ["projects"],
    sourceOfTruth: "public.projects",
    persistenceLayer: "Supabase Postgres (client stores + serverFns)",
    tenantScope: "authenticated-user",
    lifecycle: "User-owned project records for refurb workflow",
    maturity: "live",
    enforcementStatus: "partial",
    persistenceKind: "persistent",
    notes: "RLS user_id; admin select. App access still via transitional src/lib/projects.",
  },
  {
    id: "photos-media",
    label: "Project photos & media metadata",
    owner: "refurb-genius",
    tables: ["photos", "photo_analysis_results", "room_analyses"],
    storageBuckets: ["project-photos"],
    sourceOfTruth: "public.photos + storage project-photos",
    persistenceLayer: "Postgres + Storage",
    tenantScope: "authenticated-user",
    lifecycle: "Upload → metadata row → optional AI analysis rows",
    maturity: "live",
    enforcementStatus: "partial",
    persistenceKind: "persistent",
  },
  {
    id: "estimates",
    label: "Estimates",
    owner: "refurb-genius",
    tables: ["estimates", "estimate_items", "estimate_rooms"],
    sourceOfTruth: "public.estimates (+ children)",
    persistenceLayer: "Feature estimate repository + legacy paths",
    tenantScope: "authenticated-user",
    lifecycle: "Created/updated with project; rooms/items cascade ownership",
    maturity: "live",
    enforcementStatus: "partial",
    persistenceKind: "persistent",
  },
  {
    id: "ai-design",
    label: "Redesign & scope analysis",
    owner: "refurb-genius",
    tables: [
      "redesign_concepts",
      "scope_analyses",
      "scope_analysis_issues",
      "scope_analysis_items",
      "scope_analysis_rooms",
      "analysis_jobs",
    ],
    sourceOfTruth: "feature ai-design / ai-upload infrastructure tables",
    persistenceLayer: "Feature repositories + server adapters",
    tenantScope: "authenticated-user",
    lifecycle: "AI job orchestration and stored concepts/analyses",
    maturity: "live",
    enforcementStatus: "partial",
    persistenceKind: "persistent",
  },
  {
    id: "floorplans",
    label: "Floorplans",
    owner: "refurb-genius",
    tables: ["floorplan_models", "floorplan_annotations", "floorplan_measurements"],
    storageBuckets: ["floorplans"],
    sourceOfTruth: "public.floorplan_* + floorplans bucket",
    persistenceLayer: "src/lib/floorplan + queries (transitional)",
    tenantScope: "authenticated-user",
    lifecycle: "Model upload, annotations, measurements per project",
    maturity: "live",
    enforcementStatus: "partial",
    persistenceKind: "persistent",
  },
  {
    id: "feasibility-studies",
    label: "Feasibility studies & exports",
    owner: "refurb-genius",
    tables: ["feasibility_studies", "study_snapshots", "study_exports", "share_links"],
    sourceOfTruth: "public.feasibility_studies family",
    persistenceLayer: "features/feasibility + sharing repositories",
    tenantScope: "mixed",
    lifecycle: "Study create/update; snapshots/exports; share_links token public read",
    maturity: "live",
    enforcementStatus: "partial",
    persistenceKind: "persistent",
    notes: "share_links public token read + resolve_share_link RPC.",
  },
  {
    id: "gallery",
    label: "Public gallery",
    owner: "refurb-genius",
    tables: ["public_gallery_projects", "investor_leads"],
    storageBuckets: ["gallery"],
    sourceOfTruth: "public_gallery_projects + gallery bucket",
    persistenceLayer: "gallery feature + serverFns for leads",
    tenantScope: "mixed",
    lifecycle: "Published projects public read; leads insert via server",
    maturity: "live",
    enforcementStatus: "partial",
    persistenceKind: "persistent",
  },
  {
    id: "pitch-decks",
    label: "Pitch deck exports",
    owner: "refurb-genius",
    tables: ["pitch_deck_exports"],
    storageBuckets: ["pitch-decks"],
    sourceOfTruth: "pitch_deck_exports + pitch-decks bucket",
    persistenceLayer: "src/lib/pitchDeck + queries (transitional)",
    tenantScope: "authenticated-user",
    lifecycle: "Generated export metadata + private storage objects",
    maturity: "live",
    enforcementStatus: "partial",
    persistenceKind: "persistent",
  },
  {
    id: "deal-copilot",
    label: "Deal Copilot opportunities & chat",
    owner: "deal-copilot",
    tables: ["deal_opportunities", "deal_threads", "deal_messages", "opportunity_photos"],
    storageBuckets: ["project-photos"],
    sourceOfTruth: "deal_* tables (+ opportunity_photos reusing project-photos bucket)",
    persistenceLayer: "serverFns/deal* + opportunityStore (transitional direct access)",
    tenantScope: "authenticated-user",
    lifecycle: "Opportunity CRUD; threads/messages; optional photos",
    maturity: "live",
    enforcementStatus: "transitional",
    persistenceKind: "persistent",
    notes: "Assistant multi-root persistence; isolation not CI-enforced (Phase 3).",
  },
  {
    id: "marketplace-trades",
    label: "Trades marketplace",
    owner: "marketplace",
    tables: [
      "trades_jobs",
      "trades_job_interests",
      "trade_profiles",
      "trade_specialties",
      "trade_messages",
      "trade_favorites",
      "tradespeople",
      "quote_requests",
    ],
    sourceOfTruth: "trades_* / trade_* tables",
    persistenceLayer: "src/services/trades/* (transitional)",
    tenantScope: "mixed",
    lifecycle:
      "Jobs own user; posted jobs public select; interests party-scoped; profiles directory",
    maturity: "live",
    enforcementStatus: "partial",
    persistenceKind: "persistent",
  },
  {
    id: "auth-system",
    label: "Supabase Auth (users/sessions)",
    owner: "shared-platform",
    tables: [],
    sourceOfTruth: "auth schema (Supabase managed) — not in public Tables types",
    persistenceLayer: "Supabase Auth",
    tenantScope: "system",
    lifecycle: "Signup/sign-in/OAuth/session cookies (pip-auth)",
    maturity: "live",
    enforcementStatus: "enforced",
    persistenceKind: "system-owned",
    enforcementEvidence: [
      "tests/invariants/auth-env.invariant.test.ts",
      "tests/invariants/server-only-boundary.invariant.test.ts",
    ],
    notes: "auth.users not listed in generated public Tables; owned by Supabase Auth product.",
  },
];
