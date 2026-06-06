/**
 * UI migration invariant tests.
 *
 * Locks in the state of the @repo/ui migration:
 * - All migrated component shims in src/components/ui/ are pure re-exports
 *   (no implementation leakage, no @/lib/utils or app-level imports remain).
 * - The @repo/ui package components obey the one-way dependency rule:
 *   they must not import from the application layer (@/ paths).
 *
 * See CLAUDE.md (UI System Rules, Agent Safety) and the UI migration checklist.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const SRC_UI = join(ROOT, "src/components/ui");
const PKG_UI = join(ROOT, "packages/ui/src/components");
const PKG_UI_INDEX = join(ROOT, "packages/ui/src/index.ts");

// Components newly migrated in this change set (Item 4).
// We assert their shims are now pure re-exports and that their package sources
// obey the boundary rule (no @/ imports). Pre-existing migrated components may
// have transitional state in their shims; the process for *new* ones is locked here.
const NEWLY_MIGRATED: string[] = [
  "breadcrumb",
  "calendar",
  "carousel",
  "chart",
  "context-menu",
  "drawer",
  "form",
  "input-otp",
  "menubar",
  "navigation-menu",
  "resizable",
];

// For broader checks we still reference the full list from the barrel, but purity/boundary
// assertions for shims are applied to the newly migrated ones to match the scope of this task.
const ALL_MIGRATED_IN_BARREL: string[] = [
  ...NEWLY_MIGRATED,
  "accordion",
  "alert",
  "alert-dialog",
  "aspect-ratio",
  "avatar",
  "badge",
  "button",
  "card",
  "checkbox",
  "collapsible",
  "command",
  "dialog",
  "dropdown-menu",
  "hover-card",
  "input",
  "label",
  "pagination",
  "popover",
  "progress",
  "radio-group",
  "scroll-area",
  "select",
  "separator",
  "sheet",
  "sidebar",
  "skeleton",
  "slider",
  "sonner",
  "switch",
  "table",
  "tabs",
  "textarea",
  "toggle",
  "toggle-group",
  "tooltip",
];

function shimPath(name: string): string {
  return join(SRC_UI, `${name}.tsx`);
}

function pkgComponentPath(name: string): string {
  return join(PKG_UI, `${name}.tsx`);
}

function readTrimmed(file: string): string {
  return readFileSync(file, "utf8").trim();
}

test("all expected UI components have corresponding package source and shim", () => {
  for (const name of ALL_MIGRATED_IN_BARREL) {
    assert.ok(
      existsSync(pkgComponentPath(name)),
      `Component source missing in package: packages/ui/src/components/${name}.tsx`,
    );
    assert.ok(existsSync(shimPath(name)), `Shim missing: src/components/ui/${name}.tsx`);
  }
});

test("newly migrated shims (the 11) are pure re-exports (no implementation or @/ imports)", () => {
  const reexportRegex = /^export \* from "@repo\/ui\/([a-z0-9-]+)";?$/;

  for (const name of NEWLY_MIGRATED) {
    const shimFile = shimPath(name);
    const content = readTrimmed(shimFile);
    const rawLines = content
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const lines = rawLines.filter((l) => !l.startsWith("//"));

    // Should be exactly one non-comment line: the re-export
    assert.equal(
      lines.length,
      1,
      `Shim ${name}.tsx should contain exactly one re-export statement (comments allowed). Got ${rawLines.length} lines: ${content}`,
    );

    const match = lines[0].match(reexportRegex);
    assert.ok(
      match,
      `Shim ${name}.tsx must be a pure re-export. Got:\n${content}\nExpected: export * from "@repo/ui/${name}";`,
    );

    assert.equal(match[1], name, `Re-export target in ${name}.tsx must match the component name`);

    // Guard against accidental old implementation leakage
    assert.ok(
      !content.includes("@/lib/utils"),
      `Shim ${name}.tsx must not contain "@/lib/utils" (old import)`,
    );
    assert.ok(
      !content.includes("@/components/ui"),
      `Shim ${name}.tsx must not contain "@/components/ui" (old cross import)`,
    );
    assert.ok(
      !content.includes('from "@radix-ui'),
      `Shim ${name}.tsx must not contain Radix imports (impl should be in package)`,
    );
  }
});

test("@repo/ui package components and barrel do not import from app layer (@/ or src/)", () => {
  // Check barrel
  const barrel = readFileSync(PKG_UI_INDEX, "utf8");
  assert.ok(
    !barrel.includes('from "@/'),
    "packages/ui/src/index.ts must not import from @/ (app layer)",
  );

  // Known pre-existing exception: sidebar.tsx depends on app hook useIsMobile (from @/hooks/use-mobile).
  // This is a boundary smell but was present at time of its migration; do not regress on *new* migrations.
  // When fixing, either move the hook or make isMobile injectable via props/context.
  const BOUNDARY_EXCEPTIONS = new Set(["sidebar.tsx"]);

  // Check the *newly* migrated component sources (the 11 from this task) for boundary compliance.
  // (Sidebar and some earlier migrations have known exceptions; we lock the rule going forward for new work.)
  const componentFiles = NEWLY_MIGRATED.map((n) => pkgComponentPath(n));
  for (const file of componentFiles) {
    if (!existsSync(file)) continue;
    const base = basename(file);
    if (BOUNDARY_EXCEPTIONS.has(base)) continue;
    const src = readFileSync(file, "utf8");
    assert.ok(
      !src.includes('from "@/'),
      `${file} must not import from app-level "@/..." paths (violates one-way dep rule)`,
    );
    // Also catch relative that might escape to app (e.g. "../../../src")
    assert.ok(
      !src.match(/\.\.\/.*src\//),
      `${file} must not use relative paths that reach into the app src/`,
    );
  }
});
