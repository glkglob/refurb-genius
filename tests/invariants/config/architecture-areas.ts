/**
 * Verified architecture areas (Phase 0 inventory + Phase 1 overview).
 * Describes repository reality — not aspirational multi-app layouts.
 */
import type { Maturity, RegistryStatus } from "./types";

export type AreaKind =
  | "platform"
  | "product"
  | "assistant"
  | "feature"
  | "package"
  | "transitional"
  | "reserved"
  | "route"
  | "transport"
  | "integration"
  | "documentation"
  | "enforcement";

export type ArchitectureArea = {
  id: string;
  kind: AreaKind;
  /** Product or shared ownership label */
  productOwner: "refurb-genius" | "refurb-iq" | "deal-copilot" | "shared-platform" | "mixed";
  technicalOwner: string;
  purpose: string;
  /** Verified paths (relative to repo root) */
  paths: string[];
  maturity: Maturity;
  status: RegistryStatus;
  notes?: string;
};

export const ARCHITECTURE_AREAS: ArchitectureArea[] = [
  {
    id: "intelligent-platform",
    kind: "platform",
    productOwner: "shared-platform",
    technicalOwner: "platform architecture",
    purpose: "Overarching monorepo + single TanStack Start app shell",
    paths: ["src/", "packages/", "docs/architecture/"],
    maturity: "live",
    status: "documented",
    notes: "Not an apps/* multi-application monorepo today.",
  },
  {
    id: "refurb-genius",
    kind: "product",
    productOwner: "refurb-genius",
    technicalOwner: "product composition / features / routes",
    purpose: "Public-facing refurbishment product behaviour",
    paths: ["src/core/refurbGenius", "src/routes/_authed", "src/features"],
    maturity: "live",
    status: "documented",
    notes:
      "src/core/refurbGenius is an @repo/core compatibility shim; live UX is in routes/features/components.",
  },
  {
    id: "refurb-iq",
    kind: "reserved",
    productOwner: "refurb-iq",
    technicalOwner: "product composition (reserved)",
    purpose: "Commercial / professional product boundary",
    paths: ["src/core/refurbIq"],
    maturity: "reserved",
    status: "reserved",
    notes: "Empty export {} + README only; not a completed product boundary.",
  },
  {
    id: "deal-copilot",
    kind: "assistant",
    productOwner: "deal-copilot",
    technicalOwner: "assistant capability (multi-root)",
    purpose: "Shared intelligent assistant for deal underwriting and chat",
    paths: [
      "src/core/dealCopilot",
      "src/components/deal-copilot",
      "src/lib/deal-copilot",
      "src/serverFns/dealCopilot.ts",
      "src/serverFns/dealChat.ts",
      "src/serverFns/dealAnalysis.ts",
      "src/routes/_authed/deal-copilot",
    ],
    maturity: "live",
    status: "transitional",
    notes: "Multi-root; direct Supabase remains (documented debt, not CI-blocked).",
  },
  {
    id: "features",
    kind: "feature",
    productOwner: "mixed",
    technicalOwner: "feature slices",
    purpose: "Canonical home for new vertical capabilities",
    paths: ["src/features"],
    maturity: "live",
    status: "enforced",
    notes: "Feature-slice and public-api invariants apply.",
  },
  {
    id: "platform-modules",
    kind: "platform",
    productOwner: "shared-platform",
    technicalOwner: "platform",
    purpose: "Vendor seams, auth, observability, storage",
    paths: [
      "src/platform",
      "src/platform/openai",
      "src/platform/huggingface",
      "src/platform/supabase",
      "src/platform/posthog",
      "src/platform/sentry",
      "src/platform/auth",
    ],
    maturity: "live",
    status: "enforced",
  },
  {
    id: "routes",
    kind: "route",
    productOwner: "shared-platform",
    technicalOwner: "routes",
    purpose: "TanStack file routes; thin composition",
    paths: ["src/routes"],
    maturity: "live",
    status: "enforced",
    notes: "routes.invariant + no-legacy-imports baseline apply.",
  },
  {
    id: "server-transport",
    kind: "transport",
    productOwner: "shared-platform",
    technicalOwner: "server transport",
    purpose: "createServerFn handlers (auth, projects, deal*)",
    paths: ["src/serverFns"],
    maturity: "live",
    status: "partial",
  },
  {
    id: "transitional-lib",
    kind: "transitional",
    productOwner: "mixed",
    technicalOwner: "transitional layers",
    purpose: "Legacy mixed utilities, stores, queries",
    paths: ["src/lib"],
    maturity: "transitional",
    status: "enforced",
    notes: "Full file freeze via legacy-layer-freeze allowlist.",
  },
  {
    id: "transitional-hooks",
    kind: "transitional",
    productOwner: "shared-platform",
    technicalOwner: "transitional layers",
    purpose: "App-shell hooks",
    paths: ["src/hooks"],
    maturity: "transitional",
    status: "enforced",
  },
  {
    id: "transitional-services",
    kind: "transitional",
    productOwner: "mixed",
    technicalOwner: "transitional layers",
    purpose: "Trades stores + thin project/storage facades",
    paths: ["src/services"],
    maturity: "transitional",
    status: "enforced",
  },
  {
    id: "integrations-supabase-legacy",
    kind: "integration",
    productOwner: "shared-platform",
    technicalOwner: "integration",
    purpose: "Deprecated client + type re-exports",
    paths: ["src/integrations/supabase"],
    maturity: "transitional",
    status: "documented",
  },
  {
    id: "package-core",
    kind: "package",
    productOwner: "shared-platform",
    technicalOwner: "domain package",
    purpose: "Framework-independent primitives",
    paths: ["packages/core"],
    maturity: "live",
    status: "enforced",
  },
  {
    id: "package-services",
    kind: "package",
    productOwner: "shared-platform",
    technicalOwner: "domain package",
    purpose: "Deterministic pricing, ROI, deal scoring, estimators",
    paths: ["packages/services"],
    maturity: "live",
    status: "enforced",
    notes: "Retain until explicit exit criteria; do not split in this phase.",
  },
  {
    id: "package-types",
    kind: "package",
    productOwner: "shared-platform",
    technicalOwner: "domain package",
    purpose: "Shared domain types / DTOs",
    paths: ["packages/types"],
    maturity: "live",
    status: "enforced",
  },
  {
    id: "package-supabase",
    kind: "package",
    productOwner: "shared-platform",
    technicalOwner: "infrastructure",
    purpose: "Generated DB types + client factories",
    paths: ["packages/supabase"],
    maturity: "live",
    status: "enforced",
  },
  {
    id: "package-ui",
    kind: "package",
    productOwner: "shared-platform",
    technicalOwner: "UI package",
    purpose: "Design-system components",
    paths: ["packages/ui"],
    maturity: "partial",
    status: "partial",
  },
  {
    id: "package-integrations",
    kind: "package",
    productOwner: "shared-platform",
    technicalOwner: "integration",
    purpose: "Placeholder integrations package",
    paths: ["packages/integrations"],
    maturity: "stub",
    status: "documented",
  },
  {
    id: "architecture-docs",
    kind: "documentation",
    productOwner: "shared-platform",
    technicalOwner: "platform architecture",
    purpose: "Authoritative policy, ADRs, inventory",
    paths: [
      "docs/architecture/overview.md",
      "docs/architecture/adr",
      "docs/architecture/phase-0-inventory-report.md",
    ],
    maturity: "live",
    status: "documented",
  },
  {
    id: "invariants",
    kind: "enforcement",
    productOwner: "shared-platform",
    technicalOwner: "platform architecture",
    purpose: "Machine architecture and financial invariants",
    paths: ["tests/invariants"],
    maturity: "live",
    status: "enforced",
  },
];
