/**
 * Transitional layer registration.
 * Freeze allowlist *content* remains in legacy-layer-freeze.invariant.test.ts (source of truth).
 * This file registers metadata only — does not alter allowlists or freezes.
 */
import type { RegistryStatus } from "./types";

export type TransitionalLayer = {
  id: string;
  path: string;
  owner: string;
  reason: string;
  freezeStatus: "full-file-allowlist" | "none";
  freezeSourceOfTruth: string;
  migrationStrategy: string;
  reviewRequirement: string;
  enforcementStatus: RegistryStatus;
  notes?: string;
};

export const TRANSITIONAL_LAYERS: TransitionalLayer[] = [
  {
    id: "src-lib",
    path: "src/lib",
    owner: "Platform architecture + feature owners (mixed)",
    reason:
      "Historical home for utilities, domain stores, React Query modules, and Deal Copilot helpers before feature slices.",
    freezeStatus: "full-file-allowlist",
    freezeSourceOfTruth:
      "tests/invariants/config/frozen-path-allowlists.ts (LIB_ALLOWLIST) via legacy-layer-freeze.invariant.test.ts",
    migrationStrategy:
      "Incremental: move domain/DB helpers into feature infrastructure; keep pure utils or promote to packages; shrink allowlist after consumers move.",
    reviewRequirement:
      "Any new file under src/lib requires explicit review and allowlist update until freeze-lite redesign is authorised.",
    enforcementStatus: "enforced",
    notes:
      "Full directory freeze is stricter than programme freeze-lite. Do not weaken in Phase 2.",
  },
  {
    id: "src-hooks",
    path: "src/hooks",
    owner: "App shell",
    reason: "App-wide React hooks (auth, theme, mobile, projects, gallery, opportunities, role).",
    freezeStatus: "full-file-allowlist",
    freezeSourceOfTruth:
      "tests/invariants/config/frozen-path-allowlists.ts (HOOKS_ALLOWLIST) via legacy-layer-freeze.invariant.test.ts",
    migrationStrategy:
      "Feature-specific hooks move into features; keep only true app-shell hooks at root.",
    reviewRequirement: "New root hooks require review and allowlist update.",
    enforcementStatus: "enforced",
  },
  {
    id: "src-services",
    path: "src/services",
    owner: "Marketplace / projects transitional",
    reason: "Trades Supabase stores and thin project/storage facades predating feature repos.",
    freezeStatus: "full-file-allowlist",
    freezeSourceOfTruth:
      "tests/invariants/config/frozen-path-allowlists.ts (SERVICES_ALLOWLIST) via legacy-layer-freeze.invariant.test.ts",
    migrationStrategy:
      "Extract trades into a feature infrastructure repository; replace facades with feature public APIs; delete after consumers migrate.",
    reviewRequirement:
      "No new permanent services, domain engines, or Supabase surfaces without extraction plan.",
    enforcementStatus: "enforced",
  },
];
