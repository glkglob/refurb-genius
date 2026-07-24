/**
 * Tenant isolation boundaries as implemented today.
 * No organisation multi-tenancy table is present in public schema.
 */
import type { DataEnforcement, TenantScope } from "./types";

export type TenantBoundary = {
  id: string;
  scope: TenantScope;
  label: string;
  currentImplementation: string;
  enforcementStatus: DataEnforcement;
  futureIntent: string;
  examples: string[];
};

export const TENANT_BOUNDARIES: TenantBoundary[] = [
  {
    id: "user-owned-rows",
    scope: "authenticated-user",
    label: "Per-user private data",
    currentImplementation:
      "Most tables use user_id or id = auth.uid() RLS (projects, photos, estimates, deal_opportunities, feasibility_studies, etc.).",
    enforcementStatus: "enforced",
    futureIntent: "Keep user-scoped ownership; formal org tenancy only if product requires it.",
    examples: ["projects", "photos", "estimates", "deal_opportunities", "profiles"],
  },
  {
    id: "admin-elevated",
    scope: "admin-elevated",
    label: "Admin read elevation",
    currentImplementation:
      "public.is_admin() security definer + select policies (*_select_admin) on selected tables; profiles.role.",
    enforcementStatus: "enforced",
    futureIntent: "Keep admin elevation narrow; continue blocking self-role escalation.",
    examples: [
      "profiles",
      "projects",
      "photos",
      "estimates",
      "deal_opportunities",
      "feasibility_studies",
    ],
  },
  {
    id: "public-content",
    scope: "public",
    label: "Public marketplace / gallery / share tokens",
    currentImplementation:
      "public_gallery_projects public read; trades_jobs posted select; share_links token read + resolve_share_link; some storage public buckets.",
    enforcementStatus: "partial",
    futureIntent: "Keep public surfaces explicit; avoid accidental public tables.",
    examples: [
      "public_gallery_projects",
      "trades_jobs (posted)",
      "share_links",
      "gallery bucket",
      "project-photos public read",
    ],
  },
  {
    id: "party-scoped",
    scope: "party-scoped",
    label: "Multi-party marketplace messaging",
    currentImplementation:
      "trade_messages policies for conversation parties; job owners can view interests on their jobs.",
    enforcementStatus: "partial",
    futureIntent: "Preserve party checks; avoid broader open reads.",
    examples: ["trade_messages", "trades_job_interests"],
  },
  {
    id: "system-auth",
    scope: "system",
    label: "System-owned auth & triggers",
    currentImplementation:
      "auth.users managed by Supabase; handle_new_user trigger; service role only in ops scripts.",
    enforcementStatus: "enforced",
    futureIntent: "Never expose service role to browser; keep VITE_ secret bans.",
    examples: ["auth.users", "handle_new_user", "scripts/bootstrap-admin.ts"],
  },
  {
    id: "no-org-tenancy",
    scope: "shared-reference",
    label: "Organisation multi-tenancy",
    currentImplementation:
      "No organisations / workspaces / memberships tables in generated public schema.",
    enforcementStatus: "documented",
    futureIntent: "If product requires orgs, add explicit schema + RLS — do not invent now.",
    examples: [],
  },
];
