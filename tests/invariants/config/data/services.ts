/**
 * Service / capability ownership for data-touching capabilities.
 * Implementations are not moved — registration only.
 */
import type { AuthorityFlags, DataEnforcement } from "./types";

export type ServiceOwnership = {
  id: string;
  label: string;
  owningLayer: string;
  publicInterface: string;
  persistenceAuthority: string;
  dependencyDirection: string;
  enforcementStatus: DataEnforcement;
  /** When status is enforced, cite invariant or migration evidence */
  enforcementEvidence?: string[];
  paths: string[];
  authority: AuthorityFlags;
};

export const SERVICE_OWNERSHIP: ServiceOwnership[] = [
  {
    id: "ai-providers",
    label: "AI providers (OpenAI, Hugging Face)",
    owningLayer: "src/platform/* + feature adapters",
    publicInterface: "getOpenAIClient / HF helpers; feature serverFns",
    persistenceAuthority: "Ephemeral I/O; durable only via feature tables",
    dependencyDirection: "features → platform → SDK (never reverse)",
    enforcementStatus: "enforced",
    enforcementEvidence: [
      "tests/invariants/platform-boundary.invariant.test.ts",
      "tests/invariants/server-only-boundary.invariant.test.ts",
    ],
    paths: ["src/platform/openai", "src/platform/huggingface"],
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
    id: "pricing",
    label: "Pricing engine",
    owningLayer: "packages/services",
    publicInterface: "runPricingEngine",
    persistenceAuthority: "None (pure); consumers may store results",
    dependencyDirection: "app/features → @repo/services → @repo/core/types",
    enforcementStatus: "enforced",
    enforcementEvidence: [
      "tests/invariants/pricing.invariant.test.ts",
      "tests/invariants/pricing-authority.test.ts",
    ],
    paths: ["packages/services/src/pricing"],
    authority: {
      mayRead: false,
      mayWrite: false,
      ownsDurableState: false,
      derivesValues: true,
      orchestrates: false,
      externalProviderIo: false,
    },
  },
  {
    id: "roi",
    label: "ROI engine",
    owningLayer: "packages/services",
    publicInterface: "runRoiEngine (mid_total authority)",
    persistenceAuthority: "None (pure)",
    dependencyDirection: "app → @repo/services",
    enforcementStatus: "enforced",
    enforcementEvidence: ["tests/invariants/pricing-authority.test.ts"],
    paths: ["packages/services/src/roi"],
    authority: {
      mayRead: false,
      mayWrite: false,
      ownsDurableState: false,
      derivesValues: true,
      orchestrates: false,
      externalProviderIo: false,
    },
  },
  {
    id: "deal-scoring",
    label: "Deal scoring",
    owningLayer: "packages/services + dealCopilot wrappers",
    publicInterface: "scoreDealOpportunity",
    persistenceAuthority: "None for score; opportunities stored separately",
    dependencyDirection: "deal copilot / app → @repo/services",
    enforcementStatus: "enforced",
    enforcementEvidence: [
      "tests/invariants/scoring.invariant.test.ts",
      "tests/invariants/dealScore.test.ts",
    ],
    paths: ["packages/services/src/deal-analysis", "src/core/dealCopilot"],
    authority: {
      mayRead: false,
      mayWrite: false,
      ownsDurableState: false,
      derivesValues: true,
      orchestrates: false,
      externalProviderIo: false,
    },
  },
  {
    id: "authentication",
    label: "Authentication",
    owningLayer: "platform + features/auth + lib/auth",
    publicInterface: "Supabase Auth via platform browser/server clients",
    persistenceAuthority: "Auth schema + profiles trigger",
    dependencyDirection: "UI → platform/supabase → @repo/supabase",
    enforcementStatus: "enforced",
    enforcementEvidence: ["tests/invariants/auth-env.invariant.test.ts"],
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
    id: "object-storage",
    label: "Object storage",
    owningLayer: "platform + services/storage + lib/photos",
    publicInterface: "supabase.storage wrappers / getPublicPhotoUrl",
    persistenceAuthority: "Storage buckets + policies",
    dependencyDirection: "app → platform/supabase storage",
    enforcementStatus: "partial",
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
    id: "notifications-email",
    label: "Notifications / email",
    owningLayer: "lib/email + edge function",
    publicInterface: "sendEmail; edge send-notification-email",
    persistenceAuthority: "None for core product tables",
    dependencyDirection: "server → email provider",
    enforcementStatus: "documented",
    paths: ["src/lib/email.ts", "supabase/functions/send-notification-email"],
    authority: {
      mayRead: false,
      mayWrite: false,
      ownsDurableState: false,
      derivesValues: false,
      orchestrates: false,
      externalProviderIo: true,
    },
  },
  {
    id: "orchestration-feasibility",
    label: "Feasibility orchestration",
    owningLayer: "features/feasibility application",
    publicInterface: "feature public API / orchestrateFeasibility",
    persistenceAuthority: "feasibility repositories",
    dependencyDirection: "routes → feature → domain/packages",
    enforcementStatus: "partial",
    paths: ["src/features/feasibility"],
    authority: {
      mayRead: true,
      mayWrite: true,
      ownsDurableState: false,
      derivesValues: true,
      orchestrates: true,
      externalProviderIo: false,
    },
  },
];
