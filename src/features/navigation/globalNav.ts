/**
 * IA-7 / IA-7-R1 — Canonical global navigation contract.
 *
 * Six primary product destinations only. Selected-project workflow stages
 * (Photos → Export) are NOT global destinations — they live under Projects.
 *
 * New Analysis is `/analyze` (project-entry flow only).
 * Studies (and /studies/workspace feasibility) remain deep-linkable but demoted.
 */

export type GlobalNavArea =
  | "dashboard"
  | "projects"
  | "new_analysis"
  | "deal_copilot"
  | "trades_marketplace"
  | "settings"
  | null;

export type GlobalNavItemId = Exclude<GlobalNavArea, null>;

export type GlobalNavItem = {
  id: GlobalNavItemId;
  label: string;
  /** Canonical href for the Link */
  to: string;
  /** Accessible short description */
  description: string;
};

/**
 * Locked primary global destinations (order matters).
 */
export const GLOBAL_NAV_ITEMS: readonly GlobalNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    to: "/dashboard",
    description: "Portfolio command centre",
  },
  {
    id: "projects",
    label: "Projects",
    to: "/projects",
    description: "Browse and open refurbishment projects",
  },
  {
    id: "new_analysis",
    label: "New Analysis",
    // IA-0 / IA-7-R1: /analyze is the canonical project-entry flow.
    // /projects/new remains a compatibility alias of the same form.
    to: "/analyze",
    description: "Create a project and start the Photos workflow",
  },
  {
    id: "deal_copilot",
    label: "Deal Copilot",
    to: "/deal-copilot",
    description: "Analyse property opportunities",
  },
  {
    id: "trades_marketplace",
    label: "Trades / Marketplace",
    to: "/trades",
    description: "Trades jobs and marketplace",
  },
  {
    id: "settings",
    label: "Settings",
    to: "/settings",
    description: "Account and application settings",
  },
] as const;

/**
 * Resolve which global product area is active for a pathname.
 *
 * Product-area matching, not exact pathname equality:
 * - /analyze activates New Analysis
 * - /projects/new activates New Analysis (compatibility alias)
 * - /projects/$id/* activates Projects (not New Analysis)
 * - /studies/* is demoted; does not light a primary item
 */
export function resolveGlobalNavArea(pathname: string): GlobalNavArea {
  const path = normalizePath(pathname);

  if (path === "/dashboard" || path.startsWith("/dashboard/")) {
    return "dashboard";
  }

  // Canonical New Analysis entry + projects/new alias.
  if (
    path === "/analyze" ||
    path.startsWith("/analyze/") ||
    path === "/projects/new" ||
    path.startsWith("/projects/new/")
  ) {
    return "new_analysis";
  }

  // Selected-project workflow + projects list → Projects area.
  if (path === "/projects" || path.startsWith("/projects/")) {
    return "projects";
  }

  if (path === "/deal-copilot" || path.startsWith("/deal-copilot/")) {
    return "deal_copilot";
  }

  // Trades jobs + authenticated marketplace/tradespeople surfaces.
  if (
    path === "/trades" ||
    path.startsWith("/trades/") ||
    path === "/marketplace" ||
    path.startsWith("/marketplace/")
  ) {
    return "trades_marketplace";
  }

  if (path === "/settings" || path.startsWith("/settings/")) {
    return "settings";
  }

  // Demoted / non-primary: /studies, /admin, public routes, etc.
  return null;
}

export function isGlobalNavItemActive(pathname: string, itemId: GlobalNavItemId): boolean {
  return resolveGlobalNavArea(pathname) === itemId;
}

function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  // Strip query/hash if ever passed; collapse trailing slash except root.
  const bare = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  if (bare.length > 1 && bare.endsWith("/")) return bare.slice(0, -1);
  return bare || "/";
}
