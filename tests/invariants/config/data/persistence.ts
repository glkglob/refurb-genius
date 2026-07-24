/**
 * Persistence layer ownership — where writes/reads are authorised today.
 */
import type { AuthorityFlags, DataEnforcement } from "./types";

export type PersistenceSurface = {
  id: string;
  label: string;
  owner: string;
  responsibility: string;
  writeAuthority: string;
  readAuthority: string;
  enforcementStatus: DataEnforcement;
  transitional: boolean;
  paths: string[];
  authority: AuthorityFlags;
};

export const PERSISTENCE_SURFACES: PersistenceSurface[] = [
  {
    id: "browser-client-stores",
    label: "Browser client stores / lib queries",
    owner: "mixed (transitional app shell)",
    responsibility: "Client-side Supabase access for projects, photos, queries, trades facades",
    writeAuthority: "Authenticated browser client subject to RLS",
    readAuthority: "Authenticated browser client subject to RLS",
    enforcementStatus: "transitional",
    transitional: true,
    paths: ["src/lib/projects.ts", "src/lib/photos.ts", "src/lib/queries", "src/services"],
    authority: {
      mayRead: true,
      mayWrite: true,
      ownsDurableState: false,
      derivesValues: false,
      orchestrates: false,
      externalProviderIo: false,
    },
  },
  {
    id: "feature-repositories",
    label: "Feature infrastructure repositories",
    owner: "feature owners",
    responsibility: "Preferred persistence for estimates, feasibility, sharing, AI analyses",
    writeAuthority: "Feature infrastructure via platform browser/server clients + RLS",
    readAuthority: "Feature infrastructure / presentation hooks",
    enforcementStatus: "partial",
    transitional: false,
    paths: ["src/features/*/infrastructure"],
    authority: {
      mayRead: true,
      mayWrite: true,
      ownsDurableState: true,
      derivesValues: false,
      orchestrates: false,
      externalProviderIo: false,
    },
  },
  {
    id: "server-functions",
    label: "Server functions (createServerFn)",
    owner: "server transport",
    responsibility: "Auth-gated writes (projects, deal opportunities, chat, gallery leads)",
    writeAuthority: "Server cookie/session client or validated input + RLS",
    readAuthority: "Server handlers",
    enforcementStatus: "partial",
    transitional: true,
    paths: ["src/serverFns", "src/core/gallery/serverFns.ts"],
    authority: {
      mayRead: true,
      mayWrite: true,
      ownsDurableState: true,
      derivesValues: false,
      orchestrates: true,
      externalProviderIo: false,
    },
  },
  {
    id: "supabase-postgres",
    label: "Supabase Postgres (public schema)",
    owner: "shared-platform (schema) + domain owners (rows)",
    responsibility: "Canonical durable store for product data",
    writeAuthority: "RLS + triggers; service role only in scripts/ops",
    readAuthority: "RLS policies",
    enforcementStatus: "enforced",
    transitional: false,
    paths: ["packages/supabase", "supabase/migrations"],
    authority: {
      mayRead: true,
      mayWrite: true,
      ownsDurableState: true,
      derivesValues: false,
      orchestrates: false,
      externalProviderIo: false,
    },
  },
  {
    id: "supabase-storage",
    label: "Supabase Storage buckets",
    owner: "shared-platform + feature owners",
    responsibility: "Binary objects (photos, floorplans, decks, gallery)",
    writeAuthority: "Storage policies (owner folder prefixes)",
    readAuthority: "Public or private per bucket policy",
    enforcementStatus: "enforced",
    transitional: false,
    paths: ["src/services/storage", "src/lib/photos.ts"],
    authority: {
      mayRead: true,
      mayWrite: true,
      ownsDurableState: true,
      derivesValues: false,
      orchestrates: false,
      externalProviderIo: true,
    },
  },
  {
    id: "supabase-auth",
    label: "Supabase Auth sessions",
    owner: "shared-platform",
    responsibility: "Identity, sessions, OAuth, magic link",
    writeAuthority: "Auth APIs (signup/sign-in/updateUser)",
    readAuthority: "getSession/getUser server & client",
    enforcementStatus: "enforced",
    transitional: false,
    paths: ["src/platform/supabase", "src/features/auth", "src/lib/auth.ts"],
    authority: {
      mayRead: true,
      mayWrite: true,
      ownsDurableState: true,
      derivesValues: false,
      orchestrates: false,
      externalProviderIo: true,
    },
  },
  {
    id: "ai-ephemeral",
    label: "AI provider request/response (ephemeral)",
    owner: "platform AI + feature adapters",
    responsibility: "Model I/O; durable results only when written to domain tables",
    writeAuthority: "Server-only adapters (no client SDK)",
    readAuthority: "Server adapters",
    enforcementStatus: "enforced",
    transitional: false,
    paths: [
      "src/platform/openai",
      "src/platform/huggingface",
      "src/features/*/infrastructure/adapters",
    ],
    authority: {
      mayRead: true,
      mayWrite: false,
      ownsDurableState: false,
      derivesValues: true,
      orchestrates: false,
      externalProviderIo: true,
    },
  },
  {
    id: "client-memory-cache",
    label: "In-memory client caches",
    owner: "app shell / stores",
    responsibility: "opportunityStore, projectStore caches, React Query caches",
    writeAuthority: "Client process only (not multi-tenant authority)",
    readAuthority: "Same browser session",
    enforcementStatus: "documented",
    transitional: true,
    paths: ["src/core/dealCopilot/opportunityStore.ts", "src/lib/projects.ts"],
    authority: {
      mayRead: true,
      mayWrite: true,
      ownsDurableState: false,
      derivesValues: false,
      orchestrates: false,
      externalProviderIo: false,
    },
  },
  {
    id: "derived-financial",
    label: "Derived financial numbers",
    owner: "shared-platform domain engines",
    responsibility:
      "Pricing/ROI/score computed in @repo/services — not stored as authority in DB by default",
    writeAuthority: "N/A (pure compute); optional persistence of outputs in studies/exports",
    readAuthority: "Application consumers",
    enforcementStatus: "enforced",
    transitional: false,
    paths: ["packages/services"],
    authority: {
      mayRead: false,
      mayWrite: false,
      ownsDurableState: false,
      derivesValues: true,
      orchestrates: false,
      externalProviderIo: false,
    },
  },
];
