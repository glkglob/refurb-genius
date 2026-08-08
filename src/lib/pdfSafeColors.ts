/**
 * PDF capture colour compatibility (IA-5-R3B).
 *
 * Design tokens use CSS Color 4 `oklch(...)` (see src/styles.css). html2canvas
 * 1.4.x cannot parse those functions and throws:
 *   Attempting to parse an unsupported color function "oklch"
 *
 * Strategy (clone-only, live DOM unchanged):
 * 1. Rewrite unsupported colour functions in <style> / inline style text using a
 *    browser-resolved RGB/RGBA representation (standards path via getComputedStyle).
 * 2. Flatten computed styles onto the captured subtree and remove stylesheets so
 *    the renderer never re-parses raw oklch tokens from the design system.
 */

/** CSS functions known to break html2canvas 1.4.x colour parsing. */
const UNSUPPORTED_COLOR_FN_RE = /\b(?:oklch|oklab|lab|lch|color)\(\s*(?:[^()]*|\([^()]*\))*\s*\)/gi;

/** Theme custom properties that commonly resolve to oklch in this design system. */
const THEME_COLOR_VARS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--destructive-foreground",
  "--success",
  "--success-foreground",
  "--border",
  "--input",
  "--ring",
  "--field",
  "--field-foreground",
  "--placeholder",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--color-background",
  "--color-foreground",
  "--color-card",
  "--color-card-foreground",
  "--color-primary",
  "--color-primary-foreground",
  "--color-secondary",
  "--color-secondary-foreground",
  "--color-muted",
  "--color-muted-foreground",
  "--color-accent",
  "--color-accent-foreground",
  "--color-destructive",
  "--color-destructive-foreground",
  "--color-success",
  "--color-success-foreground",
  "--color-border",
  "--color-input",
  "--color-ring",
] as const;

export type CssColorResolver = (cssColor: string) => string;

/**
 * Resolve an arbitrary CSS colour (including oklch) to a renderer-safe
 * rgb()/rgba() string.
 *
 * Modern Chromium returns oklch from getComputedStyle, so we sample via a
 * 1×1 canvas (browser paints the colour; getImageData yields sRGB + alpha).
 * Alpha is preserved (rgba when non-opaque).
 */
export function createBrowserCssColorResolver(ownerDoc: Document = document): CssColorResolver {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;

  const ensureCtx = (): CanvasRenderingContext2D | null => {
    if (ctx) return ctx;
    const view = ownerDoc.defaultView;
    if (!view) return null;
    canvas = ownerDoc.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    return ctx;
  };

  return (cssColor: string): string => {
    const trimmed = cssColor.trim();
    if (!trimmed) return trimmed;
    // Already renderer-safe.
    if (!containsUnsupportedCssColorFunction(trimmed)) {
      if (/^rgba?\(/i.test(trimmed) || /^#([0-9a-f]{3,8})$/i.test(trimmed)) {
        return trimmed;
      }
    }

    const c = ensureCtx();
    if (!c) return trimmed;

    try {
      c.clearRect(0, 0, 1, 1);
      // Reset to a known state; assignment throws if the colour is unparseable.
      c.fillStyle = "#000000";
      c.fillStyle = trimmed;
      c.fillRect(0, 0, 1, 1);
      const data = c.getImageData(0, 0, 1, 1).data;
      const r = data[0] ?? 0;
      const g = data[1] ?? 0;
      const b = data[2] ?? 0;
      const a = data[3] ?? 255;
      if (a >= 255) return `rgb(${r}, ${g}, ${b})`;
      const alpha = Math.round((a / 255) * 1000) / 1000;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch {
      return "rgb(0, 0, 0)";
    }
  };
}

export function containsUnsupportedCssColorFunction(value: string): boolean {
  return /\b(?:oklch|oklab|lab|lch|color)\s*\(/i.test(value);
}

/**
 * Replace unsupported colour functions in a CSS text blob with browser-resolved
 * rgb/rgba (or a safe solid fallback when resolution fails).
 */
export function replaceUnsupportedCssColors(
  cssText: string,
  resolve: CssColorResolver,
  fallback = "rgb(0, 0, 0)",
): string {
  if (!containsUnsupportedCssColorFunction(cssText)) return cssText;
  return cssText.replace(UNSUPPORTED_COLOR_FN_RE, (match) => {
    try {
      const resolved = resolve(match.trim());
      if (!resolved || containsUnsupportedCssColorFunction(resolved)) {
        return fallback;
      }
      return resolved;
    } catch {
      return fallback;
    }
  });
}

/**
 * Build a high-priority :root theme override using RGB-resolved token values
 * from the live document. Applied only inside the html2canvas clone.
 */
export function buildPdfSafeThemeVariableCss(
  ownerDoc: Document = document,
  resolve: CssColorResolver = createBrowserCssColorResolver(ownerDoc),
): string {
  const view = ownerDoc.defaultView;
  if (!view) return "";

  const rootStyle = view.getComputedStyle(ownerDoc.documentElement);
  const decls: string[] = [];

  for (const name of THEME_COLOR_VARS) {
    const raw = rootStyle.getPropertyValue(name).trim();
    if (!raw) continue;
    const value = containsUnsupportedCssColorFunction(raw) ? resolve(raw) : raw;
    if (!value || containsUnsupportedCssColorFunction(value)) continue;
    decls.push(`${name}: ${value}`);
  }

  if (decls.length === 0) return "";
  // Force both light and dark scopes so report capture is theme-stable.
  return `:root, :host, .dark {\n  ${decls.join(";\n  ")};\n}\n`;
}

function rewriteStyleTags(clonedDoc: Document, resolve: CssColorResolver): void {
  clonedDoc.querySelectorAll("style").forEach((styleEl) => {
    const text = styleEl.textContent;
    if (!text || !containsUnsupportedCssColorFunction(text)) return;
    styleEl.textContent = replaceUnsupportedCssColors(text, resolve);
  });
}

function rewriteInlineStyles(clonedDoc: Document, resolve: CssColorResolver): void {
  clonedDoc.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const style = el.getAttribute("style");
    if (!style || !containsUnsupportedCssColorFunction(style)) return;
    el.setAttribute("style", replaceUnsupportedCssColors(style, resolve));
  });

  // SVG presentation attributes occasionally carry modern colour functions.
  clonedDoc.querySelectorAll<SVGElement>("[fill], [stroke], [color]").forEach((el) => {
    for (const attr of ["fill", "stroke", "color"] as const) {
      const value = el.getAttribute(attr);
      if (!value || !containsUnsupportedCssColorFunction(value)) continue;
      el.setAttribute(attr, replaceUnsupportedCssColors(value, resolve));
    }
  });
}

/** Properties that may carry colour values needing oklch→rgb conversion. */
const COLOR_STYLE_PROPS = [
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "column-rule-color",
  "caret-color",
  "fill",
  "stroke",
  "stop-color",
  "flood-color",
  "lighting-color",
] as const;

/** Layout / typography properties required for readable report capture. */
const LAYOUT_STYLE_PROPS = [
  "display",
  "position",
  "box-sizing",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-transform",
  "white-space",
  "word-break",
  "overflow",
  "overflow-x",
  "overflow-y",
  "opacity",
  "visibility",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "flex-direction",
  "flex-wrap",
  "justify-content",
  "align-items",
  "align-self",
  "gap",
  "row-gap",
  "column-gap",
  "grid-template-columns",
  "grid-template-rows",
  "box-shadow",
] as const;

/**
 * Flatten live computed styles onto the clone with colour values forced to
 * rgb/rgba, and strip stylesheets so html2canvas never re-parses oklch tokens.
 *
 * Note: modern Chromium returns oklch from getComputedStyle for colour props;
 * values are converted via {@link createBrowserCssColorResolver}.
 */
export function flattenComputedStylesForPdfClone(
  liveRoot: HTMLElement,
  clonedRoot: HTMLElement,
  clonedDoc: Document,
  resolve: CssColorResolver = createBrowserCssColorResolver(liveRoot.ownerDocument),
): void {
  const liveView = liveRoot.ownerDocument.defaultView;
  if (!liveView) return;

  // Remove stylesheets / style tags that may still contain unsupported functions.
  clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    // Keep our own injected pdf-safe theme block if present.
    if (node instanceof HTMLStyleElement && node.getAttribute("data-pdf-safe-colors") === "true") {
      return;
    }
    node.remove();
  });

  const liveNodes: Element[] = [liveRoot, ...Array.from(liveRoot.querySelectorAll("*"))];
  const cloneNodes: Element[] = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll("*"))];
  const count = Math.min(liveNodes.length, cloneNodes.length);

  for (let i = 0; i < count; i++) {
    const live = liveNodes[i];
    const clone = cloneNodes[i];
    if (!live || !clone) continue;

    const cs = liveView.getComputedStyle(live);

    if (live instanceof SVGElement && clone instanceof SVGElement) {
      const fill = cs.fill;
      const stroke = cs.stroke;
      if (fill && fill !== "none") {
        clone.setAttribute(
          "fill",
          containsUnsupportedCssColorFunction(fill) ? resolve(fill) : fill,
        );
      }
      if (stroke && stroke !== "none") {
        clone.setAttribute(
          "stroke",
          containsUnsupportedCssColorFunction(stroke) ? resolve(stroke) : stroke,
        );
      }
    }

    if (!(clone instanceof HTMLElement) && !(clone instanceof SVGElement)) continue;
    if (!(live instanceof Element)) continue;

    // Only HTMLElement has style.cssText assignment we need for full flattening.
    if (!(clone instanceof HTMLElement)) continue;

    let cssText = "";
    for (const prop of COLOR_STYLE_PROPS) {
      const raw = cs.getPropertyValue(prop);
      if (!raw || raw === "none") continue;
      const value = containsUnsupportedCssColorFunction(raw) ? resolve(raw) : raw;
      if (containsUnsupportedCssColorFunction(value)) continue;
      cssText += `${prop}:${value};`;
    }
    for (const prop of LAYOUT_STYLE_PROPS) {
      const raw = cs.getPropertyValue(prop);
      if (!raw) continue;
      // Guard against colour functions embedded in shorthands (e.g. box-shadow).
      const value = containsUnsupportedCssColorFunction(raw)
        ? replaceUnsupportedCssColors(raw, resolve)
        : raw;
      cssText += `${prop}:${value};`;
    }
    clone.style.cssText = cssText;
  }

  if (clonedDoc.body) {
    clonedDoc.body.style.background = "#ffffff";
  }
  if (clonedDoc.documentElement instanceof HTMLElement) {
    clonedDoc.documentElement.style.background = "#ffffff";
  }
}

export type SanitizePdfCloneOptions = {
  /** Live document used for colour resolution (defaults to `document`). */
  sourceDoc?: Document;
  /** Live capture root (required for computed-style flattening). */
  liveRoot?: HTMLElement | null;
  /** Cloned capture root (html2canvas onclone second argument). */
  clonedRoot?: HTMLElement | null;
  /** Injected colour resolver (tests). */
  resolve?: CssColorResolver;
  /**
   * When true (default), flatten computed styles and strip original stylesheets.
   * Guarantees html2canvas never parses design-system oklch tokens.
   */
  flattenComputedStyles?: boolean;
};

/**
 * Mutate only the html2canvas clone so unsupported CSS colour functions never
 * reach the renderer. Does not touch the live application DOM.
 */
export function sanitizeClonedDocumentForPdf(
  clonedDoc: Document,
  options: SanitizePdfCloneOptions = {},
): void {
  const sourceDoc = options.sourceDoc ?? document;
  const resolve = options.resolve ?? createBrowserCssColorResolver(sourceDoc);
  const flatten = options.flattenComputedStyles !== false;

  // Hide export chrome before style work.
  clonedDoc.querySelectorAll<HTMLElement>(".no-print").forEach((el) => {
    el.style.display = "none";
  });

  // First pass: rewrite raw oklch in style text / attributes (cheap safety net).
  rewriteStyleTags(clonedDoc, resolve);
  rewriteInlineStyles(clonedDoc, resolve);

  // Theme variable override (helps any remaining var(--token) resolution).
  const themeCss = buildPdfSafeThemeVariableCss(sourceDoc, resolve);
  if (themeCss) {
    const style = clonedDoc.createElement("style");
    style.setAttribute("data-pdf-safe-colors", "true");
    style.textContent = themeCss;
    const parent = clonedDoc.head ?? clonedDoc.documentElement;
    parent.appendChild(style);
  }

  // Second pass: flatten computed styles so the renderer only sees rgb/rgba.
  if (flatten && options.liveRoot && options.clonedRoot) {
    flattenComputedStylesForPdfClone(options.liveRoot, options.clonedRoot, clonedDoc, resolve);
  } else if (clonedDoc.body) {
    clonedDoc.body.style.background = "#ffffff";
  }
}
