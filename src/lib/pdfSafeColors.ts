/**
 * PDF capture colour compatibility (IA-5-R3B / IA-5-R4B).
 *
 * Design tokens use CSS Color 4 `oklch(...)` (see src/styles.css). Tailwind
 * opacity / glass utilities also emit `color-mix(in oklch|oklab, …)`. Chromium
 * often resolves those mixes to computed `oklab(...)`.
 *
 * html2canvas 1.4.x cannot parse:
 *   oklch / oklab / lab / lch / color(...)
 * and throws e.g.:
 *   Attempting to parse an unsupported color function "oklab"
 *
 * Strategy (clone-only, live DOM unchanged):
 * 1. Detect unsupported colour functions + color-mix sources.
 * 2. Resolve via browser canvas paint → sRGB rgb()/rgba() (preserves alpha).
 * 3. Flatten computed styles onto the clone and strip stylesheets so the
 *    renderer never re-parses design-system Color-4 tokens.
 * 4. Post-scrub residual Color-4 text on the clone.
 */

/** Colour functions / mixes html2canvas 1.4.x cannot safely parse. */
const UNSAFE_COLOR_TOKEN_RE = /\b(?:oklch|oklab|lab|lch|color|color-mix)\s*\(/i;

/**
 * Match a CSS function call with balanced parentheses (handles nested
 * color-mix / relative colour syntax).
 */
export function matchBalancedCssFunction(
  text: string,
  fnName: string,
  fromIndex = 0,
): { start: number; end: number; full: string } | null {
  const re = new RegExp(`\\b${fnName}\\s*\\(`, "i");
  const slice = text.slice(fromIndex);
  const m = re.exec(slice);
  if (!m || m.index === undefined) return null;
  const start = fromIndex + m.index;
  let i = start + m[0].length;
  let depth = 1;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    i += 1;
  }
  if (depth !== 0) return null;
  return { start, end: i, full: text.slice(start, i) };
}

/** True when a CSS value may still hand Color-4 syntax to html2canvas. */
export function containsUnsupportedCssColorFunction(value: string): boolean {
  return UNSAFE_COLOR_TOKEN_RE.test(value);
}

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
  "--color-field",
  "--color-field-foreground",
  "--color-placeholder",
  "--color-popover",
  "--color-popover-foreground",
  "--color-sidebar",
  "--color-sidebar-foreground",
  "--color-sidebar-primary",
  "--color-sidebar-primary-foreground",
  "--color-sidebar-accent",
  "--color-sidebar-accent-foreground",
  "--color-sidebar-border",
  "--color-sidebar-ring",
  "--color-chart-1",
  "--color-chart-2",
  "--color-chart-3",
  "--color-chart-4",
  "--color-chart-5",
  "--color-ring-offset-background",
] as const;

export type CssColorResolver = (cssColor: string) => string;

export type ColorFallbackKind = "foreground" | "background" | "border" | "generic";

/** Context-aware fallbacks — avoid black-on-black / white-on-white when conversion fails. */
export function fallbackCssColor(kind: ColorFallbackKind = "generic"): string {
  switch (kind) {
    case "background":
      return "rgb(255, 255, 255)";
    case "foreground":
      return "rgb(17, 24, 39)";
    case "border":
      return "rgb(226, 232, 240)";
    default:
      return "rgb(17, 24, 39)";
  }
}

function fallbackKindForProperty(prop: string): ColorFallbackKind {
  if (prop === "color" || prop === "caret-color" || prop === "text-decoration-color") {
    return "foreground";
  }
  if (prop === "background-color" || prop === "background" || prop === "background-image") {
    return "background";
  }
  if (prop.includes("border") || prop === "outline-color" || prop === "column-rule-color") {
    return "border";
  }
  return "generic";
}

/**
 * Resolve an arbitrary CSS colour (including oklch/oklab/lab/lch/color) to a
 * renderer-safe rgb()/rgba() string via 1×1 canvas paint (browser sRGB).
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
    // Already renderer-safe solid / alpha.
    if (!containsUnsupportedCssColorFunction(trimmed)) {
      if (/^rgba?\(/i.test(trimmed) || /^#([0-9a-f]{3,8})$/i.test(trimmed)) {
        return trimmed;
      }
    }

    const c = ensureCtx();
    if (!c) return fallbackCssColor("generic");

    try {
      c.clearRect(0, 0, 1, 1);
      c.fillStyle = "#000000";
      c.fillStyle = trimmed;
      // If the browser silently ignores an invalid colour, fillStyle stays black
      // from the reset — still a defined paint; sample pixels for alpha.
      c.fillRect(0, 0, 1, 1);
      const data = c.getImageData(0, 0, 1, 1).data;
      const r = data[0] ?? 0;
      const g = data[1] ?? 0;
      const b = data[2] ?? 0;
      const a = data[3] ?? 255;
      if (a >= 255) return `rgb(${r}, ${g}, ${b})`;
      if (a <= 0) return "rgba(0, 0, 0, 0)";
      const alpha = Math.round((a / 255) * 1000) / 1000;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch {
      return fallbackCssColor("generic");
    }
  };
}

const REPLACEABLE_FN_NAMES = ["color-mix", "oklch", "oklab", "lab", "lch", "color"] as const;

/**
 * Replace unsupported colour functions (and color-mix) in a CSS text blob with
 * browser-resolved rgb/rgba.
 */
export function replaceUnsupportedCssColors(
  cssText: string,
  resolve: CssColorResolver,
  fallback = fallbackCssColor("generic"),
): string {
  if (!containsUnsupportedCssColorFunction(cssText)) return cssText;

  let out = "";
  let cursor = 0;
  while (cursor < cssText.length) {
    let earliest: { start: number; end: number; full: string } | null = null;
    for (const name of REPLACEABLE_FN_NAMES) {
      const hit = matchBalancedCssFunction(cssText, name, cursor);
      if (!hit) continue;
      if (!earliest || hit.start < earliest.start) earliest = hit;
    }
    if (!earliest) {
      out += cssText.slice(cursor);
      break;
    }
    out += cssText.slice(cursor, earliest.start);
    try {
      const resolved = resolve(earliest.full.trim());
      if (!resolved || containsUnsupportedCssColorFunction(resolved)) {
        out += fallback;
      } else {
        out += resolved;
      }
    } catch {
      out += fallback;
    }
    cursor = earliest.end;
  }
  return out;
}

/**
 * Resolve a full computed property value that may embed Color-4 functions or
 * color-mix (box-shadow, background shorthand, etc.).
 */
export function resolveCssColorBearingValue(
  value: string,
  resolve: CssColorResolver,
  kind: ColorFallbackKind = "generic",
): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "none" || trimmed === "transparent") return trimmed;
  if (!containsUnsupportedCssColorFunction(trimmed)) return trimmed;

  // Entire value is a single colour / color-mix function → canvas resolve.
  for (const name of REPLACEABLE_FN_NAMES) {
    const hit = matchBalancedCssFunction(trimmed, name, 0);
    if (hit && hit.start === 0 && hit.end === trimmed.length) {
      const r = resolve(trimmed);
      return containsUnsupportedCssColorFunction(r) ? fallbackCssColor(kind) : r;
    }
  }

  // Compound values (box-shadow, background shorthand, multi-stop gradients).
  const replaced = replaceUnsupportedCssColors(trimmed, resolve, fallbackCssColor(kind));
  if (!containsUnsupportedCssColorFunction(replaced)) return replaced;
  return fallbackCssColor(kind);
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
    const value = containsUnsupportedCssColorFunction(raw)
      ? resolveCssColorBearingValue(raw, resolve, "generic")
      : raw;
    if (!value || containsUnsupportedCssColorFunction(value)) continue;
    decls.push(`${name}: ${value}`);
  }

  if (decls.length === 0) return "";
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

  clonedDoc
    .querySelectorAll<SVGElement>("[fill], [stroke], [color], [stop-color]")
    .forEach((el) => {
      for (const attr of ["fill", "stroke", "color", "stop-color"] as const) {
        const value = el.getAttribute(attr);
        if (!value || !containsUnsupportedCssColorFunction(value)) continue;
        el.setAttribute(attr, resolveCssColorBearingValue(value, resolve, "generic"));
      }
    });
}

/** Properties that may carry colour values needing Color-4 → rgb conversion. */
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

/** Layout / typography / shadow properties that may embed colour functions. */
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
  "text-shadow",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
] as const;

/**
 * Flatten live computed styles onto the clone with colour values forced to
 * rgb/rgba, and strip stylesheets so html2canvas never re-parses Color-4 tokens.
 */
export function flattenComputedStylesForPdfClone(
  liveRoot: HTMLElement,
  clonedRoot: HTMLElement,
  clonedDoc: Document,
  resolve: CssColorResolver = createBrowserCssColorResolver(liveRoot.ownerDocument),
): void {
  const liveView = liveRoot.ownerDocument.defaultView;
  if (!liveView) return;

  clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
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
        clone.setAttribute("fill", resolveCssColorBearingValue(fill, resolve, "generic"));
      }
      if (stroke && stroke !== "none") {
        clone.setAttribute("stroke", resolveCssColorBearingValue(stroke, resolve, "generic"));
      }
    }

    if (!(clone instanceof HTMLElement)) continue;

    let cssText = "";
    for (const prop of COLOR_STYLE_PROPS) {
      const raw = cs.getPropertyValue(prop);
      if (!raw || raw === "none") continue;
      const value = resolveCssColorBearingValue(raw, resolve, fallbackKindForProperty(prop));
      if (containsUnsupportedCssColorFunction(value)) continue;
      cssText += `${prop}:${value};`;
    }
    for (const prop of LAYOUT_STYLE_PROPS) {
      const raw = cs.getPropertyValue(prop);
      if (!raw) continue;
      // Drop Color-4 gradients; solid background-color already captured above.
      if (prop === "background-image" && containsUnsupportedCssColorFunction(raw)) {
        cssText += "background-image:none;";
        continue;
      }
      const value = containsUnsupportedCssColorFunction(raw)
        ? resolveCssColorBearingValue(raw, resolve, fallbackKindForProperty(prop))
        : raw;
      if (containsUnsupportedCssColorFunction(value)) continue;
      cssText += `${prop}:${value};`;
    }
    clone.style.cssText = cssText;
  }

  scrubResidualUnsupportedColors(clonedDoc, resolve);
  forcePdfSafeDocumentChrome(clonedDoc, resolve);
  // Final pass: re-check computed styles on the clone itself (html2canvas calls
  // parseColor on getComputedStyle after onclone — including html/body).
  scrubCloneComputedResiduals(clonedRoot, resolve);
}

/**
 * html2canvas always parseColor()'s documentElement + body backgroundColor.
 * Force opaque, renderer-safe chrome regardless of theme tokens.
 */
export function forcePdfSafeDocumentChrome(
  clonedDoc: Document,
  resolve: CssColorResolver = createBrowserCssColorResolver(clonedDoc),
): void {
  void resolve;
  const white = "rgb(255, 255, 255)";
  const ink = "rgb(17, 24, 39)";
  if (clonedDoc.documentElement instanceof HTMLElement) {
    const html = clonedDoc.documentElement;
    html.style.setProperty("background", white, "important");
    html.style.setProperty("background-color", white, "important");
    html.style.setProperty("color", ink, "important");
  }
  if (clonedDoc.body) {
    clonedDoc.body.style.setProperty("background", white, "important");
    clonedDoc.body.style.setProperty("background-color", white, "important");
    clonedDoc.body.style.setProperty("color", ink, "important");
  }
}

/**
 * After flattening, inspect the clone's own computed styles and force any
 * residual Color-4 values to rgb (covers tree-mismatch / cascade leftovers).
 */
export function scrubCloneComputedResiduals(
  clonedRoot: HTMLElement,
  resolve: CssColorResolver,
): void {
  const view = clonedRoot.ownerDocument.defaultView;
  if (!view) return;

  const nodes: Element[] = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll("*"))];
  for (const node of nodes) {
    if (!(node instanceof HTMLElement) && !(node instanceof SVGElement)) continue;
    const cs = view.getComputedStyle(node);

    for (const prop of COLOR_STYLE_PROPS) {
      const raw = cs.getPropertyValue(prop);
      if (!raw || raw === "none" || !containsUnsupportedCssColorFunction(raw)) continue;
      const safe = resolveCssColorBearingValue(raw, resolve, fallbackKindForProperty(prop));
      if (containsUnsupportedCssColorFunction(safe)) continue;
      if (node instanceof HTMLElement) {
        node.style.setProperty(prop, safe, "important");
      } else if (
        prop === "fill" ||
        prop === "stroke" ||
        prop === "color" ||
        prop === "stop-color"
      ) {
        node.setAttribute(prop, safe);
      }
    }

    for (const prop of ["box-shadow", "text-shadow", "background-image"] as const) {
      const raw = cs.getPropertyValue(prop);
      if (!raw || !containsUnsupportedCssColorFunction(raw)) continue;
      if (prop === "background-image") {
        if (node instanceof HTMLElement)
          node.style.setProperty("background-image", "none", "important");
        continue;
      }
      const safe = resolveCssColorBearingValue(raw, resolve, "generic");
      if (node instanceof HTMLElement && !containsUnsupportedCssColorFunction(safe)) {
        node.style.setProperty(prop, safe, "important");
      }
    }
  }
}

/**
 * Final defence: scrub any remaining Color-4 / color-mix text on the clone
 * (inline styles, presentation attributes, leftover style tags).
 */
export function scrubResidualUnsupportedColors(
  clonedDoc: Document,
  resolve: CssColorResolver,
): void {
  clonedDoc.querySelectorAll("style").forEach((styleEl) => {
    if (styleEl.getAttribute("data-pdf-safe-colors") === "true") {
      // Theme block should already be safe; re-check.
      const text = styleEl.textContent ?? "";
      if (containsUnsupportedCssColorFunction(text)) {
        styleEl.textContent = replaceUnsupportedCssColors(text, resolve);
      }
      return;
    }
    const text = styleEl.textContent;
    if (text && containsUnsupportedCssColorFunction(text)) {
      styleEl.textContent = replaceUnsupportedCssColors(text, resolve);
    }
  });

  clonedDoc.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const style = el.getAttribute("style");
    if (!style || !containsUnsupportedCssColorFunction(style)) return;
    el.setAttribute("style", replaceUnsupportedCssColors(style, resolve));
  });

  clonedDoc
    .querySelectorAll<SVGElement>("[fill], [stroke], [color], [stop-color]")
    .forEach((el) => {
      for (const attr of ["fill", "stroke", "color", "stop-color"] as const) {
        const value = el.getAttribute(attr);
        if (!value || !containsUnsupportedCssColorFunction(value)) continue;
        el.setAttribute(attr, resolveCssColorBearingValue(value, resolve, "generic"));
      }
    });
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
   * Guarantees html2canvas never parses design-system Color-4 tokens.
   */
  flattenComputedStyles?: boolean;
};

type HookedWindow = Window & {
  __pdfSafeCsHook?: boolean;
  __pdfSafeCsOriginal?: typeof window.getComputedStyle;
};

const COLOR_CS_PROPS = new Set([
  "color",
  "backgroundColor",
  "background-color",
  "borderTopColor",
  "border-top-color",
  "borderRightColor",
  "border-right-color",
  "borderBottomColor",
  "border-bottom-color",
  "borderLeftColor",
  "border-left-color",
  "outlineColor",
  "outline-color",
  "textDecorationColor",
  "text-decoration-color",
  "columnRuleColor",
  "column-rule-color",
  "caretColor",
  "caret-color",
  "fill",
  "stroke",
  "stopColor",
  "stop-color",
  "floodColor",
  "flood-color",
  "lightingColor",
  "lighting-color",
  "boxShadow",
  "box-shadow",
  "textShadow",
  "text-shadow",
  "background",
  "backgroundImage",
  "background-image",
  "borderColor",
  "border-color",
]);

/**
 * Chromium serialises many computed colours as oklab/oklch even when the
 * specified value was rgb(). html2canvas 1.4.x calls the *global* window
 * getComputedStyle (not only the iframe's) and parseColor on those values.
 *
 * Install a scoped hook on both the clone defaultView and the top window that
 * rewrites Color-4 serialisations **only** for elements belonging to the clone
 * document. Live application elements keep native getComputedStyle behaviour.
 */
export function installPdfSafeComputedStyleHook(
  clonedDoc: Document,
  resolve: CssColorResolver = createBrowserCssColorResolver(clonedDoc),
): void {
  const sanitizeValue = (prop: string, value: string): string => {
    if (!value || !containsUnsupportedCssColorFunction(value)) return value;
    if (prop === "backgroundImage" || prop === "background-image") {
      return "none";
    }
    return resolveCssColorBearingValue(value, resolve, fallbackKindForProperty(prop));
  };

  const proxyStyle = (style: CSSStyleDeclaration): CSSStyleDeclaration =>
    new Proxy(style, {
      get(target, prop) {
        if (prop === "getPropertyValue") {
          return (property: string) => {
            const raw = CSSStyleDeclaration.prototype.getPropertyValue.call(target, property);
            return sanitizeValue(property, raw);
          };
        }
        // Prefer direct property access bound to the native declaration (avoids
        // Illegal invocation from Reflect.get with a foreign receiver).
        if (typeof prop === "string" && COLOR_CS_PROPS.has(prop)) {
          try {
            const value = (target as unknown as Record<string, unknown>)[prop];
            if (typeof value === "string") {
              return sanitizeValue(prop, value);
            }
          } catch {
            /* fall through */
          }
        }
        const value = (target as unknown as Record<string | symbol, unknown>)[prop as string];
        if (typeof value === "function") {
          return (value as (...args: unknown[]) => unknown).bind(target);
        }
        return value;
      },
    });

  const patchWindow = (win: HookedWindow | null | undefined) => {
    if (!win || win.__pdfSafeCsHook) return;
    const original = win.getComputedStyle.bind(win);
    win.__pdfSafeCsOriginal = original;
    win.getComputedStyle = ((elt: Element, pseudoElt?: string | null) => {
      const style = original(elt, pseudoElt ?? null);
      // Only rewrite colours for the html2canvas clone document.
      if (!elt || elt.ownerDocument !== clonedDoc) {
        return style;
      }
      return proxyStyle(style);
    }) as typeof win.getComputedStyle;
    win.__pdfSafeCsHook = true;
  };

  // Patch clone iframe window AND top window — html2canvas ElementContainer
  // uses the bundle's global `window.getComputedStyle`, not the iframe's.
  patchWindow(clonedDoc.defaultView as HookedWindow | null);
  if (typeof window !== "undefined") {
    patchWindow(window as HookedWindow);
  }
}

/** Remove temporary top-window hook after PDF capture completes. */
export function uninstallPdfSafeComputedStyleHook(clonedDoc?: Document | null): void {
  const unpatch = (win: HookedWindow | null | undefined) => {
    if (!win?.__pdfSafeCsHook || !win.__pdfSafeCsOriginal) return;
    // Only unpatch the top window; clone iframe is destroyed with the capture.
    if (clonedDoc && win === clonedDoc.defaultView) return;
    win.getComputedStyle = win.__pdfSafeCsOriginal;
    delete win.__pdfSafeCsHook;
    delete win.__pdfSafeCsOriginal;
  };
  if (typeof window !== "undefined") {
    unpatch(window as HookedWindow);
  }
}

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

  clonedDoc.querySelectorAll<HTMLElement>(".no-print").forEach((el) => {
    el.style.display = "none";
  });

  rewriteStyleTags(clonedDoc, resolve);
  rewriteInlineStyles(clonedDoc, resolve);

  const themeCss = buildPdfSafeThemeVariableCss(sourceDoc, resolve);
  if (themeCss) {
    const style = clonedDoc.createElement("style");
    style.setAttribute("data-pdf-safe-colors", "true");
    style.textContent = themeCss;
    const parent = clonedDoc.head ?? clonedDoc.documentElement;
    parent.appendChild(style);
  }

  if (flatten && options.liveRoot && options.clonedRoot) {
    flattenComputedStylesForPdfClone(options.liveRoot, options.clonedRoot, clonedDoc, resolve);
  } else {
    scrubResidualUnsupportedColors(clonedDoc, resolve);
    forcePdfSafeDocumentChrome(clonedDoc, resolve);
    if (options.clonedRoot) {
      scrubCloneComputedResiduals(options.clonedRoot, resolve);
    }
  }

  // Critical: Chromium may still *serialize* computed colours as oklab/oklch.
  // Hook clone getComputedStyle so html2canvas parseColor only ever sees rgb().
  installPdfSafeComputedStyleHook(clonedDoc, resolve);
}
