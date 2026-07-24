/**
 * Dependency policy registry — registration of existing knowledge only.
 * Does not introduce new restrictions. Enforcement remains in existing tests.
 */
import type { RegistryStatus, RuleHorizon } from "./types";

export type DependencyRule = {
  id: string;
  description: string;
  /** from → to pattern (human-readable) */
  from: string;
  to: string;
  direction: "allowed" | "prohibited" | "transitional";
  horizon: RuleHorizon;
  enforcementStatus: RegistryStatus;
  /** Existing invariant or doc that carries this rule today */
  source: string;
  notes?: string;
};

/**
 * Captures current + documented dependency knowledge.
 * Future rules are marked horizon: "future" and must not be enforced by this registry alone.
 */
export const DEPENDENCY_RULES: DependencyRule[] = [
  {
    id: "pkg-no-app-src",
    description: "Packages must not import application source",
    from: "packages/*",
    to: "src/* (app paths via @/)",
    direction: "prohibited",
    horizon: "current",
    enforcementStatus: "enforced",
    source: "tests/invariants/package-dependency.invariant.test.ts",
  },
  {
    id: "pkg-no-vendor-sdk-domain",
    description: "Domain packages must not import React / Supabase / OpenAI SDKs",
    from: "packages/core|services|types",
    to: "react, @supabase/*, openai",
    direction: "prohibited",
    horizon: "current",
    enforcementStatus: "enforced",
    source: "tests/invariants/package-dependency.invariant.test.ts",
  },
  {
    id: "vendor-sdk-platform-only",
    description: "Direct vendor SDK imports only under approved platform/package paths",
    from: "src/** (except approved)",
    to: "openai, @supabase/*, posthog-*",
    direction: "prohibited",
    horizon: "current",
    enforcementStatus: "enforced",
    source: "tests/invariants/platform-boundary.invariant.test.ts",
    notes: "Approved: src/platform/*, packages/supabase/*",
  },
  {
    id: "feature-domain-no-io",
    description: "Feature domain layers must not import IO / openai package",
    from: "src/features/*/domain",
    to: "openai, network IO",
    direction: "prohibited",
    horizon: "current",
    enforcementStatus: "enforced",
    source: "tests/invariants/feature-slice.invariant.test.ts",
  },
  {
    id: "feature-public-api",
    description: "Cross-feature imports via public API",
    from: "src/features/*",
    to: "other feature internals",
    direction: "prohibited",
    horizon: "current",
    enforcementStatus: "enforced",
    source: "tests/invariants/public-api-boundary.invariant.test.ts",
  },
  {
    id: "legacy-import-baseline",
    description:
      "Routes/hooks/components/serverFns should not grow new @/lib|core|services|integrations edges",
    from: "src/routes|hooks|components|serverFns",
    to: "@/lib, @/core, @/services, @/integrations",
    direction: "prohibited",
    horizon: "current",
    enforcementStatus: "partial",
    source: "tests/invariants/no-legacy-imports.invariant.test.ts",
    notes: "Existing edges baselined; new edges fail. Baseline is interim exception mechanism.",
  },
  {
    id: "server-only-boundary",
    description: "Server-only modules and secret env must not leak to client surfaces",
    from: "client surfaces",
    to: "*.server modules, SERVICE_ROLE, OPENAI key via VITE_",
    direction: "prohibited",
    horizon: "current",
    enforcementStatus: "enforced",
    source: "tests/invariants/server-only-boundary.invariant.test.ts, auth-env.invariant.test.ts",
  },
  {
    id: "primary-orchestration",
    description: "Primary orchestration flow (target for new work)",
    from: "routes",
    to: "products/assistants → feature public APIs → domain packages → core",
    direction: "allowed",
    horizon: "current",
    enforcementStatus: "documented",
    source: "docs/architecture/overview.md",
  },
  {
    id: "genius-not-iq",
    description: "Refurb Genius must not import Refurb IQ internals (and reverse)",
    from: "refurb-genius",
    to: "refurb-iq internals",
    direction: "prohibited",
    horizon: "current",
    enforcementStatus: "documented",
    source: "docs/architecture/overview.md",
    notes: "Vacuous today — IQ reserved empty; no dedicated invariant.",
  },
  {
    id: "deal-copilot-no-direct-supabase-target",
    description: "Deal Copilot should not use direct Supabase from presentation / unapproved paths",
    from: "deal-copilot presentation / ad hoc stores",
    to: "platform/supabase browser clients & raw tables",
    direction: "prohibited",
    horizon: "future",
    enforcementStatus: "transitional",
    source: "docs/architecture/overview.md; Phase 0 V4–V6",
    notes: "Known debt; NOT enforced in CI. Do not fail builds on this registry entry.",
  },
  {
    id: "presentation-no-persistence-target",
    description: "Presentation/routes should not own persistence (target)",
    from: "presentation / thin routes",
    to: "direct supabase.from",
    direction: "prohibited",
    horizon: "future",
    enforcementStatus: "transitional",
    source: "docs/architecture/overview.md",
    notes: "Many current call sites remain; not a new CI rule in Phase 2.",
  },
  {
    id: "transitional-no-expand",
    description: "Transitional layers must not expand without review",
    from: "new files under src/lib|hooks|services",
    to: "—",
    direction: "prohibited",
    horizon: "current",
    enforcementStatus: "enforced",
    source: "tests/invariants/legacy-layer-freeze.invariant.test.ts",
  },
];
