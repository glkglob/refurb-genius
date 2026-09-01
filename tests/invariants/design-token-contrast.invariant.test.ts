/**
 * Global visual foundation — accessibility / contrast regression.
 *
 * Computes actual WCAG contrast from resolved CSS tokens. Do not replace these
 * checks with a mere "62%" string assertion.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

type Rgb = { r: number; g: number; b: number };

function extractBlocks(css: string, selector: string): string[] {
  const blocks: string[] = [];
  const re = new RegExp(`${selector}\\s*\\{`, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(css))) {
    const start = match.index + match[0].length;
    let depth = 1;
    for (let i = start; i < css.length; i++) {
      const ch = css[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          blocks.push(css.slice(start, i));
          break;
        }
      }
    }
  }
  return blocks;
}

function extractThemeBlock(css: string): string {
  const match = css.match(/@theme(?:\s+inline)?\s*\{/);
  assert.ok(match && match.index !== undefined, "styles.css must contain @theme inline");
  const start = match.index + match[0].length;
  let depth = 1;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(start, i);
    }
  }
  assert.fail("unclosed @theme block");
}

function parseDecls(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block))) {
    out[`--${match[1]}`] = match[2].trim();
  }
  return out;
}

function parseHex(hex: string): Rgb | null {
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const to = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function mixSrgb(a: Rgb, percent: number, b: Rgb): Rgb {
  const t = percent / 100;
  return {
    r: a.r * t + b.r * (1 - t),
    g: a.g * t + b.g * (1 - t),
    b: a.b * t + b.b * (1 - t),
  };
}

function resolveValue(raw: string, vars: Record<string, string>, seen = new Set<string>()): Rgb {
  const value = raw.trim();
  const hex = parseHex(value);
  if (hex) return hex;

  const varMatch = value.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i);
  if (varMatch) {
    const name = varMatch[1];
    assert.ok(!seen.has(name), `cyclic var ${name}`);
    const next = vars[name];
    assert.ok(next, `unresolved custom property ${name}`);
    const nested = new Set(seen);
    nested.add(name);
    return resolveValue(next, vars, nested);
  }

  const mix = value.match(
    /^color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+(\d+(?:\.\d+)?)%\s*,\s*(.+?)\s*\)$/i,
  );
  if (mix) {
    const left = resolveValue(mix[1], vars, seen);
    const right = resolveValue(mix[3], vars, seen);
    return mixSrgb(left, Number(mix[2]), right);
  }

  throw new Error(`cannot resolve color value: ${value}`);
}

function modeVars(css: string, mode: "light" | "dark"): Record<string, string> {
  const root = Object.assign({}, ...extractBlocks(css, ":root").map(parseDecls));
  if (mode === "light") return root;
  return { ...root, ...parseDecls(extractBlocks(css, "\\.dark")[0] ?? "") };
}

test("light page canvas is #F4F6F8 and elevated card/field surfaces remain #FFFFFF", () => {
  const css = read("src/styles.css");
  const light = modeVars(css, "light");
  assert.equal(rgbToHex(resolveValue(light["--rg-navy"], light)).toLowerCase(), "#0d2139");
  assert.equal(rgbToHex(resolveValue(light["--rg-teal"], light)).toLowerCase(), "#1b8d68");
  assert.equal(rgbToHex(resolveValue(light["--rg-white"], light)).toLowerCase(), "#ffffff");
  assert.equal(rgbToHex(resolveValue(light["--background"], light)).toLowerCase(), "#f4f6f8");
  assert.equal(rgbToHex(resolveValue(light["--card"], light)).toLowerCase(), "#ffffff");
  assert.equal(rgbToHex(resolveValue(light["--section"], light)).toLowerCase(), "#f2f5f6");
  assert.equal(rgbToHex(resolveValue(light["--field"], light)).toLowerCase(), "#ffffff");
  assert.notEqual(
    rgbToHex(resolveValue(light["--background"], light)).toLowerCase(),
    rgbToHex(resolveValue(light["--card"], light)).toLowerCase(),
  );
  assert.notEqual(
    rgbToHex(resolveValue(light["--background"], light)).toLowerCase(),
    rgbToHex(resolveValue(light["--section"], light)).toLowerCase(),
  );
});

test("supporting --section is registered and locks light #F2F5F6 / dark #14283E", () => {
  const css = read("src/styles.css");
  const theme = extractThemeBlock(css);
  assert.match(theme, /--color-section\s*:\s*var\(--section\)/);
  assert.match(css, /--color-section\s*:\s*var\(--section\)/);

  const light = modeVars(css, "light");
  const dark = modeVars(css, "dark");
  assert.equal(rgbToHex(resolveValue(light["--section"], light)).toLowerCase(), "#f2f5f6");
  assert.equal(rgbToHex(resolveValue(dark["--section"], dark)).toLowerCase(), "#14283e");
  assert.equal(rgbToHex(resolveValue(dark["--background"], dark)).toLowerCase(), "#0d2139");
  assert.equal(rgbToHex(resolveValue(dark["--rg-navy"], dark)).toLowerCase(), "#0d2139");
  assert.equal(rgbToHex(resolveValue(dark["--rg-teal"], dark)).toLowerCase(), "#1b8d68");
  assert.equal(rgbToHex(resolveValue(dark["--rg-white"], dark)).toLowerCase(), "#ffffff");
  assert.notEqual(
    rgbToHex(resolveValue(dark["--background"], dark)).toLowerCase(),
    rgbToHex(resolveValue(dark["--section"], dark)).toLowerCase(),
  );
  assert.notEqual(
    rgbToHex(resolveValue(dark["--section"], dark)).toLowerCase(),
    rgbToHex(resolveValue(dark["--card"], dark)).toLowerCase(),
  );
});

test("brand Teal remains exactly #1B8D68 and --accent stays Teal in both modes", () => {
  const css = read("src/styles.css");
  for (const mode of ["light", "dark"] as const) {
    const vars = modeVars(css, mode);
    const teal = resolveValue(vars["--rg-teal"], vars);
    assert.equal(rgbToHex(teal).toLowerCase(), "#1b8d68", `${mode} --rg-teal`);
    const accent = resolveValue(vars["--accent"], vars);
    assert.equal(rgbToHex(accent).toLowerCase(), "#1b8d68", `${mode} --accent`);
    assert.match(vars["--accent"], /var\(\s*--rg-teal\s*\)/);
  }
});

test("--accent-text is registered and accessible in both modes", () => {
  const css = read("src/styles.css");
  const theme = extractThemeBlock(css);
  assert.match(theme, /--color-accent-text\s*:\s*var\(--accent-text\)/);
  assert.match(css, /--color-accent-text\s*:\s*var\(--accent-text\)/);

  const light = modeVars(css, "light");
  const dark = modeVars(css, "dark");
  assert.match(light["--accent-text"], /var\(\s*--rg-navy\s*\)/);
  assert.match(dark["--accent-text"], /var\(\s*--rg-white\s*\)/);

  const lightText = resolveValue(light["--accent-text"], light);
  const lightBg = resolveValue(light["--background"], light);
  const lightCard = resolveValue(light["--card"], light);
  assert.ok(contrastRatio(lightText, lightBg) >= 4.5, "light accent-text vs background");
  assert.ok(contrastRatio(lightText, lightCard) >= 4.5, "light accent-text vs card");

  const darkText = resolveValue(dark["--accent-text"], dark);
  const darkBg = resolveValue(dark["--background"], dark);
  const darkCard = resolveValue(dark["--card"], dark);
  assert.ok(contrastRatio(darkText, darkBg) >= 4.5, "dark accent-text vs background");
  assert.ok(contrastRatio(darkText, darkCard) >= 4.5, "dark accent-text vs card");
});

test("placeholder tokens differ by mode and meet 4.5:1 against the actual field", () => {
  const css = read("src/styles.css");
  const light = modeVars(css, "light");
  const dark = modeVars(css, "dark");

  assert.match(
    light["--placeholder"],
    /color-mix\(\s*in\s+srgb\s*,\s*var\(--rg-navy\)\s+62%\s*,\s*var\(--rg-white\)\s*\)/,
  );
  assert.match(
    dark["--placeholder"],
    /color-mix\(\s*in\s+srgb\s*,\s*var\(--rg-white\)\s+62%\s*,\s*var\(--rg-navy\)\s*\)/,
  );

  const lightPh = resolveValue(light["--placeholder"], light);
  const darkPh = resolveValue(dark["--placeholder"], dark);
  assert.notEqual(rgbToHex(lightPh).toLowerCase(), rgbToHex(darkPh).toLowerCase());

  const lightField = resolveValue(light["--field"], light);
  const darkField = resolveValue(dark["--field"], dark);
  const lightContrast = contrastRatio(lightPh, lightField);
  const darkContrast = contrastRatio(darkPh, darkField);
  assert.ok(
    lightContrast >= 4.5,
    `light placeholder contrast ${lightContrast.toFixed(2)}:1 vs field ${rgbToHex(lightField)}`,
  );
  assert.ok(
    darkContrast >= 4.5,
    `dark placeholder contrast ${darkContrast.toFixed(2)}:1 vs field ${rgbToHex(darkField)}`,
  );

  assert.equal(rgbToHex(resolveValue(light["--field-foreground"], light)).toLowerCase(), "#0d2139");
  assert.equal(rgbToHex(resolveValue(dark["--field-foreground"], dark)).toLowerCase(), "#ffffff");
});

test("dark --field-ring meets 3:1 against the actual dark field", () => {
  const css = read("src/styles.css");
  const theme = extractThemeBlock(css);
  assert.match(theme, /--color-field-ring\s*:\s*var\(--field-ring\)/);

  const light = modeVars(css, "light");
  const dark = modeVars(css, "dark");
  assert.match(light["--field-ring"], /var\(\s*--rg-teal\s*\)/);
  assert.match(dark["--field-ring"], /var\(\s*--rg-white\s*\)/);
  assert.match(light["--sidebar-ring"], /var\(\s*--rg-teal\s*\)/);
  assert.match(dark["--sidebar-ring"], /var\(\s*--rg-teal\s*\)/);

  const darkRing = resolveValue(dark["--field-ring"], dark);
  const darkField = resolveValue(dark["--field"], dark);
  const ratio = contrastRatio(darkRing, darkField);
  assert.ok(
    ratio >= 3,
    `dark field-ring contrast ${ratio.toFixed(2)}:1 vs field ${rgbToHex(darkField)}`,
  );

  const lightRing = resolveValue(light["--field-ring"], light);
  const lightField = resolveValue(light["--field"], light);
  const lightRatio = contrastRatio(lightRing, lightField);
  assert.ok(lightRatio >= 3, `light field-ring contrast ${lightRatio.toFixed(2)}:1`);
});

test("Auth fields no longer use the failing placeholder mix or low-opacity primary ring", () => {
  const src = read("src/features/auth/presentation/AuthExperience.tsx");
  assert.doesNotMatch(src, /placeholder:text-muted-foreground\/70/);
  assert.match(src, /placeholder:text-placeholder/);
  assert.doesNotMatch(src, /ring-primary\/30/);
  assert.match(src, /focus-visible:ring-2 focus-visible:ring-primary(?!\/)/);
});

test("StatusBadge accent normal text does not use text-accent", () => {
  const src = read("src/components/StatusBadge.tsx");
  assert.match(src, /accent:\s*"bg-accent\/10 text-accent-text border-accent\/20"/);
  assert.doesNotMatch(src, /accent:\s*"[^"]*\btext-accent"/);
});

test("__root Go home no longer uses an inaccessible text-bearing Teal hover", () => {
  const src = read("src/routes/__root.tsx");
  const anchors = [...src.matchAll(/<a\b[^>]*className="([^"]+)"[^>]*>\s*Go home/g)];
  assert.equal(anchors.length, 2, "expected two Go home anchors");
  for (const match of anchors) {
    const className = match[1];
    assert.doesNotMatch(className, /hover:bg-accent(?!-)/);
    assert.match(className, /hover:bg-secondary/);
    assert.match(className, /text-foreground/);
  }
});

test("Dialog Close no longer produces muted-on-Teal low contrast", () => {
  const src = read("packages/ui/src/components/dialog.tsx");
  assert.match(src, /<span className="sr-only">Close<\/span>/);
  assert.doesNotMatch(src, /data-\[state=open\]:bg-accent/);
  assert.doesNotMatch(src, /data-\[state=open\]:text-muted-foreground/);
  assert.match(src, /data-\[state=open\]:bg-secondary/);
  assert.match(src, /data-\[state=open\]:text-secondary-foreground/);
  assert.match(src, /focus:ring-2 focus:ring-ring/);
});

test("shared menu selected/focus state no longer uses inaccessible White-on-Teal normal text", () => {
  const src = read("packages/ui/src/components/dropdown-menu.tsx");
  assert.doesNotMatch(src, /focus:text-accent-foreground/);
  assert.doesNotMatch(src, /focus:bg-accent(?!-)/);
  assert.match(src, /focus:bg-secondary focus:text-secondary-foreground/);
  assert.match(src, /\bbg-popover\b/);
  assert.match(src, /\btext-popover-foreground\b/);
});

test("opaque popover invariant remains intact", () => {
  const css = read("src/styles.css");
  assert.match(css, /:root\s*\{[\s\S]*?--popover:\s*oklch\([^)/]+\)/);
  assert.match(css, /\.dark\s*\{[\s\S]*?--popover:\s*oklch\([^)/]+\)/);
  assert.doesNotMatch(css, /--popover:\s*oklch\([^)]*\/\s*0\s*\)/);
  assert.doesNotMatch(css, /--popover:\s*transparent/);
  const theme = extractThemeBlock(css);
  assert.match(theme, /--color-popover\s*:\s*var\(--popover\)/);
  assert.match(theme, /--color-popover-foreground\s*:\s*var\(--popover-foreground\)/);
});

test("dark elevated card and nested inset lock exact supporting HEX", () => {
  const css = read("src/styles.css");
  const theme = extractThemeBlock(css);
  assert.match(theme, /--color-inset\s*:\s*var\(--inset\)/);
  assert.match(css, /--color-inset\s*:\s*var\(--inset\)/);

  const light = modeVars(css, "light");
  const dark = modeVars(css, "dark");

  assert.equal(rgbToHex(resolveValue(light["--rg-navy"], light)).toLowerCase(), "#0d2139");
  assert.equal(rgbToHex(resolveValue(light["--rg-teal"], light)).toLowerCase(), "#1b8d68");
  assert.equal(rgbToHex(resolveValue(light["--rg-white"], light)).toLowerCase(), "#ffffff");
  assert.equal(rgbToHex(resolveValue(light["--background"], light)).toLowerCase(), "#f4f6f8");
  assert.equal(rgbToHex(resolveValue(light["--section"], light)).toLowerCase(), "#f2f5f6");
  assert.equal(rgbToHex(resolveValue(light["--card"], light)).toLowerCase(), "#ffffff");
  assert.equal(rgbToHex(resolveValue(light["--inset"], light)).toLowerCase(), "#f2f5f6");
  assert.match(light["--inset"], /var\(\s*--section\s*\)/);
  assert.match(light["--card"], /var\(\s*--rg-white\s*\)/);

  assert.equal(rgbToHex(resolveValue(dark["--background"], dark)).toLowerCase(), "#0d2139");
  assert.equal(rgbToHex(resolveValue(dark["--section"], dark)).toLowerCase(), "#14283e");
  assert.equal(rgbToHex(resolveValue(dark["--card"], dark)).toLowerCase(), "#162a41");
  assert.equal(rgbToHex(resolveValue(dark["--inset"], dark)).toLowerCase(), "#102338");
  assert.match(dark["--card"], /^#162a41$/i);
  assert.match(dark["--inset"], /^#102338$/i);
  assert.doesNotMatch(dark["--card"], /color-mix/);
  assert.equal(rgbToHex(resolveValue(dark["--accent"], dark)).toLowerCase(), "#1b8d68");
});

test("foreground remains >= 4.5:1 against canvas, section, card, and inset", () => {
  const css = read("src/styles.css");
  const light = modeVars(css, "light");
  const dark = modeVars(css, "dark");

  const lightFg = resolveValue(light["--foreground"], light);
  for (const token of ["--background", "--section", "--card", "--inset"] as const) {
    const ratio = contrastRatio(lightFg, resolveValue(light[token], light));
    assert.ok(ratio >= 4.5, `light foreground vs ${token} ${ratio.toFixed(2)}:1`);
  }

  const darkFg = resolveValue(dark["--foreground"], dark);
  for (const token of ["--background", "--section", "--card", "--inset"] as const) {
    const ratio = contrastRatio(darkFg, resolveValue(dark[token], dark));
    assert.ok(ratio >= 4.5, `dark foreground vs ${token} ${ratio.toFixed(2)}:1`);
  }
});

test("dark muted hierarchy does not invert above the elevated card", () => {
  const css = read("src/styles.css");
  const dark = modeVars(css, "dark");
  const canvas = resolveValue(dark["--background"], dark);
  const section = resolveValue(dark["--section"], dark);
  const card = resolveValue(dark["--card"], dark);
  const inset = resolveValue(dark["--inset"], dark);
  const muted = resolveValue(dark["--muted"], dark);

  assert.match(dark["--muted"], /var\(\s*--inset\s*\)/);
  assert.equal(rgbToHex(muted).toLowerCase(), rgbToHex(inset).toLowerCase());
  assert.equal(rgbToHex(card).toLowerCase(), "#162a41");
  assert.equal(rgbToHex(inset).toLowerCase(), "#102338");

  const canvasL = relativeLuminance(canvas);
  const sectionL = relativeLuminance(section);
  const cardL = relativeLuminance(card);
  const mutedL = relativeLuminance(muted);
  const insetL = relativeLuminance(inset);

  assert.ok(canvasL < sectionL, "dark canvas must sit below section");
  assert.ok(sectionL < cardL, "dark section must sit below elevated card");
  assert.ok(mutedL < cardL, "dark muted must not sit above elevated card");
  assert.ok(insetL < cardL, "dark inset must nest below elevated card");
});

test("shared Card primitive paints opaque semantic bg-card", () => {
  const src = read("packages/ui/src/components/card.tsx");
  assert.match(src, /\bbg-card\b/);
  assert.doesNotMatch(src, /bg-card\/\d+/);
  assert.doesNotMatch(src, /backdrop-blur/);
});

test("HowItWorks step numerals use muted-foreground with >= 3:1 contrast against card", () => {
  const src = read("src/routes/index.tsx");
  const fn = src.match(/function HowItWorks\(\) \{[\s\S]*?\nfunction /);
  assert.ok(fn, "HowItWorks function must exist");

  const numeralClass = [...fn[0].matchAll(/<span className="([^"]+)"/g)]
    .map((match) => match[1])
    .find((className) => /\btext-5xl\b/.test(className) && /\bfont-bold\b/.test(className));
  assert.ok(numeralClass, "HowItWorks step numeral span must exist");
  assert.match(numeralClass, /\btext-muted-foreground\b/);
  assert.doesNotMatch(numeralClass, /\btext-secondary\b/);
  assert.match(numeralClass, /\babsolute\b/);

  const css = read("src/styles.css");
  for (const mode of ["light", "dark"] as const) {
    const vars = modeVars(css, mode);
    const fg = resolveValue(vars["--muted-foreground"], vars);
    const bg = resolveValue(vars["--card"], vars);
    const ratio = contrastRatio(fg, bg);
    assert.ok(
      ratio >= 3,
      `HowItWorks numeral ${mode} muted-foreground vs card ${ratio.toFixed(2)}:1 (${rgbToHex(fg)} on ${rgbToHex(bg)})`,
    );
  }
});

test("BeforeAfter After label uses opaque card surface with >= 4.5:1 contrast", () => {
  const src = read("src/routes/index.tsx");
  const fn = src.match(/function BeforeAfter\(\) \{[\s\S]*?\nfunction /);
  assert.ok(fn, "BeforeAfter function must exist");

  const afterClass = fn[0].match(/<span className="([^"]+)"[^>]*>\s*After\s*</)?.[1];
  assert.ok(afterClass, "BeforeAfter After label span must exist");
  assert.match(afterClass, /\bbg-card\b/);
  assert.match(afterClass, /\btext-card-foreground\b/);
  assert.doesNotMatch(afterClass, /bg-accent\/15/);
  assert.doesNotMatch(afterClass, /bg-card\/\d+/);

  const css = read("src/styles.css");
  for (const mode of ["light", "dark"] as const) {
    const vars = modeVars(css, mode);
    const fg = resolveValue(vars["--card-foreground"], vars);
    const bg = resolveValue(vars["--card"], vars);
    const ratio = contrastRatio(fg, bg);
    assert.ok(
      ratio >= 4.5,
      `BeforeAfter After label ${mode} card-foreground vs card ${ratio.toFixed(2)}:1 (${rgbToHex(fg)} on ${rgbToHex(bg)})`,
    );
  }
});
