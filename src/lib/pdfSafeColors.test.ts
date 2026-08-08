import { describe, expect, it, vi } from "vitest";
import {
  buildPdfSafeThemeVariableCss,
  containsUnsupportedCssColorFunction,
  matchBalancedCssFunction,
  replaceUnsupportedCssColors,
  resolveCssColorBearingValue,
  sanitizeClonedDocumentForPdf,
  scrubResidualUnsupportedColors,
} from "./pdfSafeColors";

describe("pdfSafeColors (IA-5-R3B / IA-5-R4B)", () => {
  it("detects unsupported CSS colour functions and color-mix", () => {
    expect(containsUnsupportedCssColorFunction("oklch(0.55 0.15 168)")).toBe(true);
    expect(containsUnsupportedCssColorFunction("oklab(0.77 -0.07 0.02)")).toBe(true);
    expect(containsUnsupportedCssColorFunction("oklch(0.92 0.012 252 / 28%)")).toBe(true);
    expect(containsUnsupportedCssColorFunction("lab(50% 40 30)")).toBe(true);
    expect(
      containsUnsupportedCssColorFunction(
        "color-mix(in oklch, var(--color-card) 88%, transparent)",
      ),
    ).toBe(true);
    expect(
      containsUnsupportedCssColorFunction("color-mix(in oklab, var(--muted) 30%, transparent)"),
    ).toBe(true);
    expect(containsUnsupportedCssColorFunction("rgb(10, 20, 30)")).toBe(false);
    expect(containsUnsupportedCssColorFunction("#112233")).toBe(false);
  });

  it("matchBalancedCssFunction handles nested parentheses", () => {
    const text = "box-shadow: 0 0 0 2px color-mix(in oklch, var(--color-ring) 35%, transparent);";
    const hit = matchBalancedCssFunction(text, "color-mix");
    expect(hit?.full).toBe("color-mix(in oklch, var(--color-ring) 35%, transparent)");
  });

  it("replaces oklch and oklab (incl. alpha / negative channels) via injected resolver", () => {
    const resolve = vi.fn((color: string) => {
      if (color.includes("oklab")) return "rgb(134, 198, 173)";
      if (color.includes("/ 28%") || color.includes("/ 0.28")) return "rgba(200, 200, 210, 0.28)";
      if (color.includes("0.55")) return "rgb(16, 148, 112)";
      return "rgb(0, 0, 0)";
    });

    const input = `
      :root {
        --background: oklch(0.985 0.008 250);
        --primary: oklch(0.55 0.15 168);
        --border: oklch(0.92 0.012 252 / 28%);
        --mix: color-mix(in oklch, var(--primary) 50%, white);
      }
      .card {
        color: oklab(0.774997 -0.0733383 0.0156034);
        border-color: oklch(0.92 0.012 252 / 28%);
        box-shadow: 0 8px 24px -6px color-mix(in oklch, var(--primary) 55%, transparent);
      }
    `;

    const out = replaceUnsupportedCssColors(input, resolve);
    expect(out).not.toMatch(/oklch/i);
    expect(out).not.toMatch(/oklab/i);
    expect(out).not.toMatch(/color-mix/i);
    expect(out).toContain("rgb(16, 148, 112)");
    expect(out).toContain("rgb(134, 198, 173)");
    expect(out).toContain("rgba(200, 200, 210, 0.28)");
    expect(out).toContain(".card");
    expect(resolve).toHaveBeenCalled();
  });

  it("uses fallback when resolver cannot produce a safe colour", () => {
    const resolve = () => "oklch(0.5 0.1 100)"; // still unsupported
    const out = replaceUnsupportedCssColors("color: oklch(0.5 0.1 100);", resolve, "rgb(1, 2, 3)");
    expect(out).toBe("color: rgb(1, 2, 3);");
  });

  it("resolveCssColorBearingValue converts pure oklab and compound shadows", () => {
    const resolve = (c: string) => {
      if (c.includes("oklab")) return "rgb(10, 20, 30)";
      if (c.includes("oklch")) return "rgb(40, 50, 60)";
      return c;
    };
    expect(resolveCssColorBearingValue("oklab(0.5 0.1 -0.05)", resolve)).toBe("rgb(10, 20, 30)");
    expect(
      resolveCssColorBearingValue("oklch(0.78 0.16 168 / 0.55) 0px 8px 24px -6px", resolve),
    ).toBe("rgb(40, 50, 60) 0px 8px 24px -6px");
  });

  it("buildPdfSafeThemeVariableCss emits only resolved non-oklch declarations", () => {
    document.documentElement.style.setProperty("--background", "oklch(0.985 0.008 250)");
    document.documentElement.style.setProperty("--foreground", "oklch(0.22 0.04 258)");
    document.documentElement.style.setProperty("--primary", "rgb(16, 148, 112)");

    const resolve = (c: string) => {
      if (c.includes("0.985")) return "rgb(248, 250, 252)";
      if (c.includes("0.22")) return "rgb(30, 41, 59)";
      return c;
    };

    const css = buildPdfSafeThemeVariableCss(document, resolve);
    expect(css).toMatch(/:root/);
    expect(css).toContain("--background: rgb(248, 250, 252)");
    expect(css).toContain("--foreground: rgb(30, 41, 59)");
    expect(css).toContain("--primary: rgb(16, 148, 112)");
    expect(css).not.toMatch(/oklch/i);

    document.documentElement.style.removeProperty("--background");
    document.documentElement.style.removeProperty("--foreground");
    document.documentElement.style.removeProperty("--primary");
  });

  it("sanitizeClonedDocumentForPdf rewrites style tags and hides .no-print", () => {
    const cloned = document.implementation.createHTMLDocument("pdf-clone");
    cloned.body.innerHTML = `
      <style>:root { --x: oklch(0.55 0.15 168); } .t { color: oklab(0.5 0.1 0.02); }</style>
      <div class="print-area">
        <button class="no-print">Download</button>
        <p style="color: oklch(0.3 0.02 250)">Body</p>
      </div>
    `;
    const live = document.createElement("div");
    live.className = "print-area";
    live.innerHTML = `<p>Body</p>`;
    document.body.appendChild(live);

    const resolve = () => "rgb(10, 20, 30)";
    const clonedRoot = cloned.querySelector(".print-area") as HTMLElement;

    sanitizeClonedDocumentForPdf(cloned, {
      sourceDoc: document,
      liveRoot: live,
      clonedRoot,
      resolve,
      flattenComputedStyles: false,
    });

    const styleText = Array.from(cloned.querySelectorAll("style"))
      .map((s) => s.textContent ?? "")
      .join("\n");
    expect(styleText).not.toMatch(/oklch/i);
    expect(styleText).not.toMatch(/oklab/i);
    expect(styleText).toContain("rgb(10, 20, 30)");
    expect((cloned.querySelector(".no-print") as HTMLElement).style.display).toBe("none");
    expect(cloned.querySelector("p")?.getAttribute("style") ?? "").toContain("rgb(10, 20, 30)");
    expect(cloned.querySelector("p")?.getAttribute("style") ?? "").not.toMatch(/oklch|oklab/i);

    live.remove();
  });

  it("flatten path removes original stylesheets so Color-4 cannot be re-parsed", () => {
    const cloned = document.implementation.createHTMLDocument("pdf-clone");
    cloned.head.innerHTML = `<style>.x{color:oklab(0.5 0.1 0.02);background:color-mix(in oklch, red 50%, white)}</style>`;
    cloned.body.innerHTML = `<div class="print-area"><span>Hi</span></div>`;

    const live = document.createElement("div");
    live.className = "print-area";
    live.innerHTML = `<span>Hi</span>`;
    document.body.appendChild(live);

    const clonedRoot = cloned.querySelector(".print-area") as HTMLElement;
    sanitizeClonedDocumentForPdf(cloned, {
      sourceDoc: document,
      liveRoot: live,
      clonedRoot,
      resolve: () => "rgb(1,1,1)",
      flattenComputedStyles: true,
    });

    const remaining = Array.from(cloned.querySelectorAll("style")).filter(
      (s) => s.dataset.pdfSafeColors !== "true",
    );
    expect(remaining).toHaveLength(0);
    expect(clonedRoot.getAttribute("style") || clonedRoot.style.cssText).toBeTruthy();
    const allText = cloned.documentElement.outerHTML;
    expect(allText).not.toMatch(/oklab\s*\(/i);
    expect(allText).not.toMatch(/color-mix\s*\(/i);

    live.remove();
  });

  it("scrubResidualUnsupportedColors cleans leftover inline Color-4", () => {
    const cloned = document.implementation.createHTMLDocument("scrub");
    cloned.body.innerHTML = `<div style="color: oklab(0.4 0.1 0.05); box-shadow: 0 0 4px oklch(0.5 0.1 100)"></div>`;
    scrubResidualUnsupportedColors(cloned, () => "rgb(9, 9, 9)");
    const style = cloned.querySelector("div")?.getAttribute("style") ?? "";
    expect(style).not.toMatch(/oklab|oklch/i);
    expect(style).toContain("rgb(9, 9, 9)");
  });

  it("forcePdfSafeDocumentChrome sets html/body to opaque rgb (html2canvas samples these)", async () => {
    const { forcePdfSafeDocumentChrome } = await import("./pdfSafeColors");
    const cloned = document.implementation.createHTMLDocument("chrome");
    cloned.documentElement.style.backgroundColor = "oklab(0.2 0.01 0.02)";
    cloned.body.style.backgroundColor = "oklch(0.16 0.02 262)";
    forcePdfSafeDocumentChrome(cloned, () => "rgb(1,2,3)");
    expect(cloned.documentElement.style.backgroundColor).toMatch(/rgb|255/i);
    expect(cloned.body.style.backgroundColor).toMatch(/rgb|255/i);
    expect(cloned.documentElement.style.backgroundColor).not.toMatch(/oklab|oklch/i);
    expect(cloned.body.style.backgroundColor).not.toMatch(/oklab|oklch/i);
  });

  it("installPdfSafeComputedStyleHook is exported and idempotent to install", async () => {
    const { installPdfSafeComputedStyleHook } = await import("./pdfSafeColors");
    const resolve = (c: string) => (/oklab|oklch/i.test(c) ? "rgb(1, 2, 3)" : c);
    // Use an isolated document so we do not permanently patch the test window.
    const isolated = document.implementation.createHTMLDocument("hook");
    // jsdom documents may lack a defaultView; skip hook behaviour if so.
    if (!isolated.defaultView) {
      expect(typeof installPdfSafeComputedStyleHook).toBe("function");
      return;
    }
    installPdfSafeComputedStyleHook(isolated, resolve);
    installPdfSafeComputedStyleHook(isolated, resolve); // second call no-ops
    expect(typeof isolated.defaultView.getComputedStyle).toBe("function");
  });
});
