/**
 * Security ownership inventory (classification only).
 */
import type { DataEnforcement } from "./types";

export type SecurityItem = {
  id: string;
  label: string;
  owner: string;
  implementation: string;
  enforcementStatus: DataEnforcement;
  evidence: string[];
};

export const SECURITY_INVENTORY: SecurityItem[] = [
  {
    id: "authentication",
    label: "Authentication",
    owner: "shared-platform",
    implementation: "Supabase Auth (email/password, OAuth, magic link, cookies pip-auth)",
    enforcementStatus: "enforced",
    evidence: [
      "src/features/auth",
      "src/platform/supabase",
      "tests/invariants/auth-env.invariant.test.ts",
    ],
  },
  {
    id: "authorisation-rls",
    label: "Authorisation (RLS)",
    owner: "shared-platform + domain table owners",
    implementation:
      "Postgres RLS policies; is_admin(); own-row patterns; public select where intended",
    enforcementStatus: "enforced",
    evidence: [
      "supabase/migrations/20260513093000_admin-role-system.sql",
      "supabase/migrations/20260721230000_p0_security_rls_hardening.sql",
    ],
  },
  {
    id: "authorisation-app-role",
    label: "App role checks",
    owner: "shared-platform",
    implementation: "profiles.role + useRole + RequireAdmin; prevent_role_self_escalation",
    enforcementStatus: "enforced",
    evidence: [
      "src/lib/role.ts",
      "supabase/migrations/20260721230000_p0_security_rls_hardening.sql",
    ],
  },
  {
    id: "storage-access",
    label: "Storage access",
    owner: "shared-platform",
    implementation: "Bucket policies for project-photos, floorplans, pitch-decks, gallery",
    enforcementStatus: "enforced",
    evidence: [
      "supabase/migrations/20260610120000_ensure_project_photos_bucket.sql",
      "src/services/storage/index.ts",
    ],
  },
  {
    id: "secrets",
    label: "Secrets & keys",
    owner: "shared-platform",
    implementation:
      "Server env OPENAI/HF/service role; ban VITE_ private keys (auth-env invariant)",
    enforcementStatus: "enforced",
    evidence: [
      "tests/invariants/auth-env.invariant.test.ts",
      "tests/invariants/server-only-boundary.invariant.test.ts",
    ],
  },
  {
    id: "service-role",
    label: "Service role usage",
    owner: "shared-platform / ops",
    implementation: "bootstrap-admin script and controlled server paths only — not browser",
    enforcementStatus: "enforced",
    evidence: ["scripts/bootstrap-admin.ts", "tests/invariants/auth-env.invariant.test.ts"],
  },
  {
    id: "share-tokens",
    label: "Share link tokens",
    owner: "refurb-genius",
    implementation: "share_links policies + resolve_share_link RPC",
    enforcementStatus: "enforced",
    evidence: [
      "supabase/migrations/20260610130000_feasibility_studies_foundation.sql",
      "supabase/migrations/20260721230000_p0_security_rls_hardening.sql",
    ],
  },
];
