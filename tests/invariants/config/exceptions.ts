/**
 * Structured architecture exceptions (Phase 3).
 * Populated only with verified existing freezes/baselines — no speculative debt.
 *
 * Tracking issue / review / expiry use explicit "unresolved" when repo evidence
 * does not provide project-management metadata (do not invent issue numbers).
 */
import type { ExceptionStatus } from "./types";
import { HOOKS_ALLOWLIST, LIB_ALLOWLIST, SERVICES_ALLOWLIST } from "./frozen-path-allowlists";
import { LEGACY_IMPORT_BASELINE } from "./legacy-import-baseline";

export type ArchitectureException = {
  id: string;
  owner: string;
  scope: string;
  /** Dependency / freeze rule id from dependencies.ts or freezes */
  affectedRule: string;
  reason: string;
  risk: string;
  /** Durable tracker ID if available; "unresolved" if none in repo */
  trackingIssue: string;
  /** ISO date YYYY-MM-DD or "unresolved" */
  reviewDate: string;
  /** ISO date YYYY-MM-DD or "unresolved" */
  expiry: string;
  removalCondition: string;
  status: ExceptionStatus;
  sourceInvariant: string;
  /** Optional single edge source|import */
  affectedEdge?: string;
  /** Exact paths covered (freeze allowlists) */
  exactPaths?: readonly string[];
  /** Exact dependency edges source|import */
  exactEdges?: readonly string[];
  /**
   * required: every path must exist (stale baseline fails)
   * soft-missing-ok: missing paths allowed (layer shrink / resolved imports)
   */
  pathPresence: "required" | "soft-missing-ok";
};

export const UNRESOLVED = "unresolved" as const;

/**
 * Verified structured exceptions corresponding to existing CI baselines.
 */
export const ARCHITECTURE_EXCEPTIONS: ArchitectureException[] = [
  {
    id: "freeze-src-lib-path-allowlist",
    owner: "unresolved — platform architecture (default)",
    scope: "src/lib/**/*.ts(x) file set freeze",
    affectedRule: "transitional-no-expand",
    reason:
      "Historical transitional files under src/lib; full-directory freeze prevents new domain modules outside feature slices.",
    risk: "Low if freezes hold; medium if allowlist grows without review (domain leakage continues).",
    trackingIssue: UNRESOLVED,
    reviewDate: UNRESOLVED,
    expiry: UNRESOLVED,
    removalCondition:
      "Remove individual paths from LIB_ALLOWLIST after consumers migrate to features/packages and imports no longer require them.",
    status: "active",
    sourceInvariant: "tests/invariants/legacy-layer-freeze.invariant.test.ts",
    exactPaths: LIB_ALLOWLIST,
    pathPresence: "soft-missing-ok",
  },
  {
    id: "freeze-src-hooks-path-allowlist",
    owner: "unresolved — platform architecture (default)",
    scope: "src/hooks/**/*.ts(x) file set freeze",
    affectedRule: "transitional-no-expand",
    reason: "App-shell hooks only; feature hooks belong in features.",
    risk: "Low; root hooks expansion recreates horizontal layering.",
    trackingIssue: UNRESOLVED,
    reviewDate: UNRESOLVED,
    expiry: UNRESOLVED,
    removalCondition:
      "Delete allowlisted hooks only after call sites move to feature hooks or platform auth.",
    status: "active",
    sourceInvariant: "tests/invariants/legacy-layer-freeze.invariant.test.ts",
    exactPaths: HOOKS_ALLOWLIST,
    pathPresence: "soft-missing-ok",
  },
  {
    id: "freeze-src-services-path-allowlist",
    owner: "unresolved — platform architecture (default)",
    scope: "src/services/**/*.ts file set freeze",
    affectedRule: "transitional-no-expand",
    reason: "Trades stores and thin facades pending feature infrastructure extraction.",
    risk: "Medium if new permanent services land here instead of features.",
    trackingIssue: UNRESOLVED,
    reviewDate: UNRESOLVED,
    expiry: UNRESOLVED,
    removalCondition:
      "Migrate trades/storage/projects facades to feature infrastructure and delete services files.",
    status: "active",
    sourceInvariant: "tests/invariants/legacy-layer-freeze.invariant.test.ts",
    exactPaths: SERVICES_ALLOWLIST,
    pathPresence: "soft-missing-ok",
  },
  {
    id: "baseline-legacy-imports-routes-hooks-components-serverfns",
    owner: "unresolved — platform architecture (default)",
    scope:
      "Forbidden @/core|lib|services|integrations imports from routes/hooks/components/serverFns",
    affectedRule: "legacy-import-baseline",
    reason:
      "Pre-existing import edges from app shell surfaces into transitional layers; ratchet blocks new edges only.",
    risk: "Medium maintainability debt; new edges would reverse feature-slice migration.",
    trackingIssue: UNRESOLVED,
    reviewDate: UNRESOLVED,
    expiry: UNRESOLVED,
    removalCondition:
      "Remove edges from LEGACY_IMPORT_BASELINE when the source file no longer imports the forbidden specifier (test reports resolved entries).",
    status: "active",
    sourceInvariant: "tests/invariants/no-legacy-imports.invariant.test.ts",
    exactEdges: LEGACY_IMPORT_BASELINE,
    pathPresence: "soft-missing-ok",
  },
  {
    id: "ui-migration-sidebar-app-hook",
    owner: "unresolved — platform architecture (default)",
    scope: "packages/ui sidebar.tsx app-layer import exception for newly migrated component checks",
    affectedRule: "pkg-no-app-src",
    reason:
      "Known pre-existing boundary smell: sidebar depends on app hook useIsMobile; locked so new migrations cannot add @/ imports.",
    risk: "Low-medium package purity; injectable isMobile preferred long-term.",
    trackingIssue: UNRESOLVED,
    reviewDate: UNRESOLVED,
    expiry: UNRESOLVED,
    removalCondition:
      "Make isMobile injectable via props/context or move hook; then remove sidebar.tsx from UI_MIGRATION_BOUNDARY_EXCEPTIONS.",
    status: "active",
    sourceInvariant: "tests/invariants/ui-migration.invariant.test.ts",
    exactPaths: ["packages/ui/src/components/sidebar.tsx"],
    pathPresence: "required",
  },
];

export const EXCEPTION_REQUIRED_FIELDS = [
  "id",
  "owner",
  "scope",
  "affectedRule",
  "reason",
  "risk",
  "trackingIssue",
  "reviewDate",
  "expiry",
  "removalCondition",
  "status",
  "sourceInvariant",
  "pathPresence",
] as const satisfies readonly (keyof ArchitectureException)[];

/** Filenames allowed as boundary exceptions in ui-migration newly-migrated checks */
export const UI_MIGRATION_BOUNDARY_EXCEPTIONS = ["sidebar.tsx"] as const;
