import { describe, expect, it, vi } from "vitest";
import {
  buildPdfSafeThemeVariableCss,
  containsUnsupportedCssColorFunction,
  replaceUnsupportedCssColors,
  sanitizeClonedDocumentForPdf,
} from "./pdfSafeColors";

describe("pdfSafeColors (IA-5-R3B)", () => {
  it("detects unsupported CSS colour functions", () => {
    expect(containsUnsupportedCssColorFunction("oklch(0.55 0.15 168)")).toBe(true);
    expect(containsUnsupportedCssColorFunction("oklch(0.92 0.012 252 / 28%)")).toBe(true);
    expect(containsUnsupportedCssColorFunction("lab(50% 40 30)")).toBe(true);
    expect(containsUnsupportedCssColorFunction("rgb(10, 20, 30)")).toBe(false);
    expect(containsUnsupportedCssColorFunction("#112233")).toBe(false);
  });

  it("replaces oklch (incl. alpha) via injected resolver and preserves surrounding CSS", () => {
    const resolve = vi.fn((color: string) => {
      if (color.includes("/ 28%")) return "rgba(200, 200, 210, 0.28)";
      if (color.includes("0.55")) return "rgb(16, 148, 112)";
      return "rgb(0, 0, 0)";
    });

    const input = `
      :root {
        --background: oklch(0.985 0.008 250);
        --primary: oklch(0.55 0.15 168);
        --border: oklch(0.92 0.012 252 / 28%);
      }
      .card { color: oklch(0.22 0.04 258); border-color: oklch(0.92 0.012 252 / 28%); }
    `;

    const out = replaceUnsupportedCssColors(input, resolve);
    expect(out).not.toMatch(/oklch/i);
    expect(out).toContain("rgb(16, 148, 112)");
    expect(out).toContain("rgba(200, 200, 210, 0.28)");
    expect(out).toContain(".card");
    expect(resolve).toHaveBeenCalled();
  });

  it("uses fallback when resolver cannot produce a safe colour", () => {
    const resolve = () => "oklch(0.5 0.1 100)"; // still unsupported
    const out = replaceUnsupportedCssColors("color: oklch(0.5 0.1 100);", resolve, "rgb(1, 2, 3)");
    expect(out).toBe("color: rgb(1, 2, 3);");
  });

  it("buildPdfSafeThemeVariableCss emits only resolved non-oklch declarations", () => {
    // jsdom may not implement full oklch resolution; use document with mock vars.
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
      <style>:root { --x: oklch(0.55 0.15 168); } .t { color: oklch(0.2 0.02 250); }</style>
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
    expect(styleText).toContain("rgb(10, 20, 30)");
    expect((cloned.querySelector(".no-print") as HTMLElement).style.display).toBe("none");
    // Inline oklch rewritten as well.
    expect(cloned.querySelector("p")?.getAttribute("style") ?? "").toContain("rgb(10, 20, 30)");
    expect(cloned.querySelector("p")?.getAttribute("style") ?? "").not.toMatch(/oklch/i);

    live.remove();
  });

  it("flatten path removes original stylesheets so oklch cannot be re-parsed", () => {
    const cloned = document.implementation.createHTMLDocument("pdf-clone");
    cloned.head.innerHTML = `<style>.x{color:oklch(0.5 0.1 100)}</style>`;
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

    // Original oklch style tag removed (only optional pdf-safe theme may remain).
    const remaining = Array.from(cloned.querySelectorAll("style")).filter(
      (s) => s.dataset.pdfSafeColors !== "true",
    );
    expect(remaining).toHaveLength(0);
    expect(clonedRoot.getAttribute("style") || clonedRoot.style.cssText).toBeTruthy();

    live.remove();
  });
});
