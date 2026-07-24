/**
 * Architecture registry integrity + structured exception governance (Phase 2–3).
 *
 * Does NOT introduce product-isolation or Deal Copilot Supabase enforcement.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  AI_BOUNDARIES,
  ARCHITECTURE_AREAS,
  ARCHITECTURE_EXCEPTIONS,
  DEPENDENCY_RULES,
  ENFORCEMENT_INVENTORY,
  EXCEPTION_REQUIRED_FIELDS,
  HOOKS_ALLOWLIST,
  LEGACY_IMPORT_BASELINE,
  LIB_ALLOWLIST,
  OWNERSHIP,
  REGISTRY_META,
  SERVICES_ALLOWLIST,
  TRANSITIONAL_LAYERS,
  UNRESOLVED,
} from "./config/index.ts";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

function pathExists(rel: string): boolean {
  if (rel.includes("<") || rel === "(not implemented)") return true;
  if (rel.endsWith("/**")) {
    const base = rel.replace(/\/\*\*$/, "");
    return existsSync(join(ROOT, base));
  }
  if (rel.includes("*")) {
    const base = rel.split("*")[0]?.replace(/\/$/, "") ?? "";
    return base === "" || existsSync(join(ROOT, base));
  }
  return existsSync(join(ROOT, rel));
}

const RULE_IDS = new Set(DEPENDENCY_RULES.map((r) => r.id));
// Freezes share transitional-no-expand
RULE_IDS.add("transitional-no-expand");
RULE_IDS.add("legacy-import-baseline");
RULE_IDS.add("pkg-no-app-src");

test("registry meta describes Phase 5 with data integrity ratchets", () => {
  assert.equal(REGISTRY_META.phase, 5);
  assert.ok(REGISTRY_META.purpose.includes("data") || REGISTRY_META.purpose.includes("integrity"));
  assert.ok(existsSync(join(ROOT, REGISTRY_META.policySourceOfTruth)));
  assert.ok(existsSync(join(ROOT, REGISTRY_META.freezeSourceOfTruth)));
  assert.ok(existsSync(join(ROOT, REGISTRY_META.evidenceSourceOfTruth)));
  assert.ok(existsSync(join(ROOT, REGISTRY_META.legacyImportBaselineSourceOfTruth)));
  assert.ok(existsSync(join(ROOT, REGISTRY_META.dataRegistry)));
});

test("ownership registry has required product and platform records", () => {
  const ids = new Set(OWNERSHIP.map((o) => o.id));
  for (const required of [
    "refurb-genius",
    "refurb-iq",
    "deal-copilot",
    "platform",
    "shared",
    "packages",
  ]) {
    assert.ok(ids.has(required), `missing ownership id: ${required}`);
  }
});

test("architecture area paths exist on disk", () => {
  for (const area of ARCHITECTURE_AREAS) {
    for (const p of area.paths) {
      assert.ok(pathExists(p), `area ${area.id}: missing path ${p}`);
    }
  }
});

test("dependency rules mark future/target rules as non-enforced", () => {
  const future = DEPENDENCY_RULES.filter((r) => r.horizon === "future");
  for (const r of future) {
    assert.notEqual(
      r.enforcementStatus,
      "enforced",
      `future rule must not claim enforced: ${r.id}`,
    );
  }
});

test("transitional layers register lib, hooks, services", () => {
  const paths = TRANSITIONAL_LAYERS.map((l) => l.path).sort();
  assert.deepEqual(paths, ["src/hooks", "src/lib", "src/services"]);
});

test("AI boundaries register platform SDK homes", () => {
  const sdk = AI_BOUNDARIES.find((b) => b.id === "provider-sdk-platform-only");
  assert.ok(sdk);
  assert.equal(sdk!.enforcementStatus, "enforced");
  for (const loc of sdk!.approvedLocations) {
    assert.ok(pathExists(loc), `AI approved location missing: ${loc}`);
  }
});

test("structured exceptions have unique IDs and required governance fields", () => {
  assert.ok(ARCHITECTURE_EXCEPTIONS.length >= 1);
  const ids = ARCHITECTURE_EXCEPTIONS.map((e) => e.id);
  assert.equal(ids.length, new Set(ids).size, "duplicate exception ids");

  for (const ex of ARCHITECTURE_EXCEPTIONS) {
    for (const field of EXCEPTION_REQUIRED_FIELDS) {
      const value = ex[field];
      assert.ok(
        value !== undefined && value !== null && String(value).length > 0,
        `${ex.id}: missing ${field}`,
      );
    }
    assert.ok(
      ["active", "expired", "removed", "draft"].includes(ex.status),
      `${ex.id}: invalid status`,
    );
    assert.ok(RULE_IDS.has(ex.affectedRule), `${ex.id}: unknown affectedRule ${ex.affectedRule}`);
    // Allow unresolved for tracker/dates — do not invent PM data
    if (ex.trackingIssue !== UNRESOLVED) {
      assert.ok(ex.trackingIssue.length > 0);
    }
    if (ex.reviewDate !== UNRESOLVED) {
      assert.match(ex.reviewDate, /^\d{4}-\d{2}-\d{2}$/);
    }
    if (ex.expiry !== UNRESOLVED) {
      assert.match(ex.expiry, /^\d{4}-\d{2}-\d{2}$/);
    }
    assert.ok(
      pathExists(ex.sourceInvariant),
      `${ex.id}: sourceInvariant path missing: ${ex.sourceInvariant}`,
    );
  }
});

test("structured exceptions do not duplicate the same scope", () => {
  const scopes = ARCHITECTURE_EXCEPTIONS.map((e) => e.scope);
  assert.equal(scopes.length, new Set(scopes).size, "duplicate exception scopes");
});

test("required-path exceptions reference existing paths; soft-missing freezes may shrink", () => {
  for (const ex of ARCHITECTURE_EXCEPTIONS) {
    if (ex.pathPresence === "required" && ex.exactPaths) {
      for (const p of ex.exactPaths) {
        assert.ok(
          pathExists(p),
          `Exception ${ex.id}: path no longer exists — remove from exception/baseline: ${p}`,
        );
      }
    }
    if (ex.exactEdges) {
      // Edge baseline files must still exist if soft-missing-ok is not used for edges
      // source file half of edge
      for (const edge of ex.exactEdges) {
        const file = edge.split("|")[0] ?? "";
        if (ex.pathPresence === "required") {
          assert.ok(pathExists(file), `Exception ${ex.id}: edge source missing ${file}`);
        }
      }
    }
  }
});

test("freeze allowlists match structured freeze exceptions", () => {
  const libEx = ARCHITECTURE_EXCEPTIONS.find((e) => e.id === "freeze-src-lib-path-allowlist");
  const hooksEx = ARCHITECTURE_EXCEPTIONS.find((e) => e.id === "freeze-src-hooks-path-allowlist");
  const svcEx = ARCHITECTURE_EXCEPTIONS.find((e) => e.id === "freeze-src-services-path-allowlist");
  assert.deepEqual([...(libEx?.exactPaths ?? [])].sort(), [...LIB_ALLOWLIST].sort());
  assert.deepEqual([...(hooksEx?.exactPaths ?? [])].sort(), [...HOOKS_ALLOWLIST].sort());
  assert.deepEqual([...(svcEx?.exactPaths ?? [])].sort(), [...SERVICES_ALLOWLIST].sort());
});

test("legacy import baseline matches structured exception edge set", () => {
  const leg = ARCHITECTURE_EXCEPTIONS.find(
    (e) => e.id === "baseline-legacy-imports-routes-hooks-components-serverfns",
  );
  assert.ok(leg?.exactEdges);
  assert.deepEqual([...(leg!.exactEdges ?? [])].sort(), [...LEGACY_IMPORT_BASELINE].sort());
});

test("enforcement inventory references existing invariant files", () => {
  for (const item of ENFORCEMENT_INVENTORY.filter((i) => i.status === "active")) {
    if (item.source === "(not implemented)") continue;
    assert.ok(pathExists(item.source), `enforcement source missing: ${item.source}`);
  }
  for (const item of ENFORCEMENT_INVENTORY.filter((i) => i.status === "planned")) {
    assert.equal(item.enforcementLevel, "planned");
  }
});
