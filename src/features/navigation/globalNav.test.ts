import { describe, it, expect } from "vitest";
import {
  GLOBAL_NAV_ITEMS,
  MOBILE_MORE_NAV_IDS,
  MOBILE_PRIMARY_NAV_IDS,
  getGlobalNavItem,
  getMobileMoreNavItems,
  getMobilePrimaryNavItems,
  isGlobalNavItemActive,
  resolveGlobalNavArea,
} from "./globalNav";

describe("IA-7 / IA-8 global navigation contract", () => {
  it("exposes exactly six primary destinations in locked order", () => {
    expect(GLOBAL_NAV_ITEMS.map((i) => i.id)).toEqual([
      "dashboard",
      "projects",
      "new_analysis",
      "deal_copilot",
      "trades_marketplace",
      "settings",
    ]);
    expect(GLOBAL_NAV_ITEMS.map((i) => i.label)).toEqual([
      "Dashboard",
      "Projects",
      "New Analysis",
      "Deal Copilot",
      "Marketplace",
      "Settings",
    ]);
    const marketplace = GLOBAL_NAV_ITEMS.find((i) => i.id === "trades_marketplace");
    expect(marketplace?.label).toBe("Marketplace");
    expect(marketplace?.to).toBe("/marketplace");
  });

  it("does not include Studies or stage routes as primary destinations", () => {
    const labels = GLOBAL_NAV_ITEMS.map((i) => i.label).join(" ");
    const tos = GLOBAL_NAV_ITEMS.map((i) => i.to).join(" ");
    expect(labels).not.toMatch(/Studies/i);
    expect(tos).not.toMatch(/studies|upload|analysis|redesign|estimate|report/i);
  });

  it("New Analysis href is canonical /analyze", () => {
    const item = GLOBAL_NAV_ITEMS.find((i) => i.id === "new_analysis");
    expect(item?.to).toBe("/analyze");
  });

  it("matches Dashboard only on dashboard", () => {
    expect(resolveGlobalNavArea("/dashboard")).toBe("dashboard");
    expect(isGlobalNavItemActive("/dashboard", "dashboard")).toBe(true);
    expect(isGlobalNavItemActive("/projects", "dashboard")).toBe(false);
  });

  it("matches Projects for list and selected-project workflow subtree", () => {
    const projectPaths = [
      "/projects",
      "/projects/",
      "/projects/abc",
      "/projects/abc/upload",
      "/projects/abc/analysis",
      "/projects/abc/redesign",
      "/projects/abc/estimate",
      "/projects/abc/report",
      "/projects/abc/scope",
    ];
    for (const p of projectPaths) {
      expect(resolveGlobalNavArea(p)).toBe("projects");
      expect(isGlobalNavItemActive(p, "projects")).toBe(true);
      expect(isGlobalNavItemActive(p, "new_analysis")).toBe(false);
    }
  });

  it("matches New Analysis on /analyze and /projects/new alias", () => {
    expect(resolveGlobalNavArea("/analyze")).toBe("new_analysis");
    expect(isGlobalNavItemActive("/analyze", "new_analysis")).toBe(true);
    expect(isGlobalNavItemActive("/analyze", "projects")).toBe(false);
    expect(resolveGlobalNavArea("/projects/new")).toBe("new_analysis");
    expect(isGlobalNavItemActive("/projects/new", "new_analysis")).toBe(true);
    expect(isGlobalNavItemActive("/projects/new", "projects")).toBe(false);
  });

  it("matches Deal Copilot subtree", () => {
    expect(resolveGlobalNavArea("/deal-copilot")).toBe("deal_copilot");
    expect(resolveGlobalNavArea("/deal-copilot/new")).toBe("deal_copilot");
    expect(resolveGlobalNavArea("/deal-copilot/opp-1")).toBe("deal_copilot");
  });

  it("matches Marketplace area across /marketplace and /trades board surfaces", () => {
    expect(resolveGlobalNavArea("/marketplace")).toBe("trades_marketplace");
    expect(resolveGlobalNavArea("/marketplace/")).toBe("trades_marketplace");
    expect(resolveGlobalNavArea("/trades")).toBe("trades_marketplace");
    expect(resolveGlobalNavArea("/trades/new")).toBe("trades_marketplace");
    expect(resolveGlobalNavArea("/trades/job-1")).toBe("trades_marketplace");
  });

  it("matches Settings", () => {
    expect(resolveGlobalNavArea("/settings")).toBe("settings");
  });

  it("does not activate primary items for demoted Studies surfaces", () => {
    expect(resolveGlobalNavArea("/studies")).toBeNull();
    expect(resolveGlobalNavArea("/studies/xyz")).toBeNull();
    expect(resolveGlobalNavArea("/studies/workspace")).toBeNull();
  });

  it("IA-8 mobile primary + more covers all six canonical destinations", () => {
    const primary = getMobilePrimaryNavItems();
    const more = getMobileMoreNavItems();
    const allIds = [...primary.map((i) => i.id), ...more.map((i) => i.id)];
    expect(new Set(allIds).size).toBe(6);
    expect(allIds).toEqual(expect.arrayContaining(GLOBAL_NAV_ITEMS.map((i) => i.id)));
    // Final public-beta mobile structure: Home | Projects | + New | Copilot | More
    expect(MOBILE_PRIMARY_NAV_IDS).toEqual([
      "dashboard",
      "projects",
      "new_analysis",
      "deal_copilot",
    ]);
    expect(MOBILE_MORE_NAV_IDS).toEqual(["trades_marketplace", "settings"]);
    expect(primary.map((i) => i.to)).toEqual([
      "/dashboard",
      "/projects",
      "/analyze",
      "/deal-copilot",
    ]);
    expect(more.map((i) => i.to)).toEqual(["/marketplace", "/settings"]);
    expect(more.map((i) => i.label)).toEqual(["Marketplace", "Settings"]);
    expect(getGlobalNavItem("trades_marketplace").to).toBe("/marketplace");
    expect(getGlobalNavItem("trades_marketplace").label).toBe("Marketplace");
    expect(getGlobalNavItem("new_analysis").to).toBe("/analyze");
  });
});
