/**
 * PH-TRUTH — customer-facing product truth assertions (source-level).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = __dirname;
const landing = readFileSync(join(root, "index.tsx"), "utf8");
const gallery = readFileSync(join(root, "gallery.tsx"), "utf8");
const gallerySlug = readFileSync(join(root, "gallery.$slug.tsx"), "utf8");
const support = readFileSync(join(root, "support.tsx"), "utf8");

describe("PH-TRUTH customer-facing copy", () => {
  it("CIR-TRUTH-01: demo financials are labelled illustrative/sample", () => {
    expect(landing).toMatch(/Illustrative example/i);
    expect(landing).toMatch(/sample scenario/i);
    // Numbers remain but must not stand alone without context in cost card
    expect(landing).toContain("£64,500");
    expect(landing).toMatch(/not a live customer result|not a verified customer outcome/i);
  });

  it("CIR-TRUTH-03: unsupported Real Projects / Real Renovations provenance absent", () => {
    expect(gallery).not.toMatch(/Real UK property transformations/i);
    expect(gallery).not.toMatch(/verified investors/i);
    expect(gallery).not.toMatch(/Real Projects/i);
    expect(gallery).not.toMatch(/Real Renovations/i);
    expect(gallerySlug).not.toMatch(/Real numbers, real results/i);
    expect(gallery).toMatch(/Examples|inspiration|Sample transformations/i);
  });

  it("CIR-TRUTH-04: Support PDF wording matches live export capability", () => {
    expect(support).not.toMatch(/PDF export functionality[\s\S]{0,40}coming soon/i);
    expect(support).not.toMatch(/This feature is coming soon[\s\S]{0,80}PDF/i);
    expect(support).toMatch(/Export stage/i);
    expect(support).toMatch(/investor-ready PDF/i);
  });

  it("CIR-TRUTH-05: surveyor-equivalent professional claims bounded", () => {
    expect(landing).not.toMatch(/the way a surveyor would/i);
    expect(landing).not.toMatch(/structural engineer/i);
    expect(landing).not.toMatch(/is equivalent to a survey/i);
    expect(landing).toMatch(/AI-assisted condition/i);
    expect(landing).toMatch(/not a professional survey or structural inspection/i);
  });
});
