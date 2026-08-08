/**
 * IA-8-R1 — Opaque overlay surface (semantic bg-popover) registration.
 *
 * Root cause of More/Select/Popover bleed: Tailwind v4 only emits bg-popover
 * (and other semantic color utilities) when --color-* tokens are registered
 * via @theme / @theme inline. Defining --color-popover on :root alone is not
 * enough — the utility is never generated and computed background is transparent.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** Extract the first top-level @theme / @theme inline { ... } block body. */
function extractThemeBlock(css: string): string {
  const match = css.match(/@theme(?:\s+inline)?\s*\{/);
  assert.ok(
    match && match.index !== undefined,
    "styles.css must contain an @theme or @theme inline block",
  );
  const start = match.index + match[0].length;
  let depth = 1;
  for (let i = start; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return css.slice(start, i);
    }
  }
  assert.fail("unclosed @theme block in styles.css");
}

test("styles.css registers semantic popover color tokens in @theme (Tailwind v4)", () => {
  const css = read("src/styles.css");
  // Guard against accidental comment-terminator sequences that abort @theme parsing
  // (e.g. writing bg-*/text-* inside a block comment).
  assert.doesNotMatch(
    css,
    /\/\*[^*]*bg-\s*\*\//,
    "styles.css must not embed bg-*/ inside a block comment (premature comment end)",
  );

  const theme = extractThemeBlock(css);
  assert.match(theme, /--color-popover\s*:\s*var\(--popover\)/);
  assert.match(theme, /--color-popover-foreground\s*:\s*var\(--popover-foreground\)/);
  assert.match(theme, /--color-background\s*:\s*var\(--background\)/);
  assert.match(theme, /--color-card\s*:\s*var\(--card\)/);
});

test("styles.css defines opaque theme-aware --popover values (light + dark)", () => {
  const css = read("src/styles.css");
  // Light (:root) and dark (.dark) must set solid oklch popover surfaces (no alpha channel).
  assert.match(css, /:root\s*\{[\s\S]*?--popover:\s*oklch\([^)/]+\)/);
  assert.match(css, /\.dark\s*\{[\s\S]*?--popover:\s*oklch\([^)/]+\)/);
  // Reject intentional transparency on the popover token itself.
  assert.doesNotMatch(css, /--popover:\s*oklch\([^)]*\/\s*0\s*\)/);
  assert.doesNotMatch(css, /--popover:\s*transparent/);
});

test("shared overlay primitives paint with bg-popover (not a one-off light-only class)", () => {
  const files = [
    "packages/ui/src/components/dropdown-menu.tsx",
    "packages/ui/src/components/select.tsx",
    "packages/ui/src/components/popover.tsx",
    "packages/ui/src/components/context-menu.tsx",
  ];
  for (const rel of files) {
    const src = read(rel);
    assert.match(src, /\bbg-popover\b/, `${rel} must use bg-popover for opaque overlay surface`);
    assert.match(
      src,
      /\btext-popover-foreground\b/,
      `${rel} must use text-popover-foreground for readable overlay text`,
    );
    assert.doesNotMatch(
      src,
      /\bbg-white\b/,
      `${rel} must not hard-code bg-white (breaks dark mode)`,
    );
  }
});

test("MobileTopBar More menu uses DropdownMenuContent (inherits opaque popover surface)", () => {
  const src = read("src/components/MobileTopBar.tsx");
  assert.match(src, /DropdownMenuContent/);
  assert.match(src, /mobile-nav-more/);
  // Content surface comes from the shared primitive — do not reintroduce a transparent override.
  assert.doesNotMatch(src, /DropdownMenuContent[^>]*className=\{[^}]*bg-transparent/);
});
