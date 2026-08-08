/**
 * IA-6 — Overview source contract: canonical five-stage + resolver, no legacy flags.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "projects.$id.index.tsx"), "utf8");
const DASHBOARD = readFileSync(join(__dirname, "dashboard.tsx"), "utf8");
const UPLOAD = readFileSync(join(__dirname, "projects.$id.upload.tsx"), "utf8");

describe("IA-6 Overview continuation contract", () => {
  it("uses useProjectFiveStageWorkflow for Overview shell", () => {
    expect(SRC).toMatch(/useProjectFiveStageWorkflow/);
    expect(SRC).toMatch(/explainProjectNextActionReason/);
  });

  it("does not import or call progressFromProjectFlags", () => {
    expect(SRC).not.toMatch(/progressFromProjectFlags\s*\(/);
    expect(SRC).not.toMatch(/import\s*\{[^}]*progressFromProjectFlags/);
  });

  it("primary CTA is resolver-driven", () => {
    expect(SRC).toMatch(/overview-primary-cta|overview-continue-cta/);
    expect(SRC).toMatch(/nextAction\.route|nextAction\?\.route/);
    expect(SRC).toMatch(/data-action-kind/);
  });

  it("documents Overview is not a workflow stage", () => {
    // Shell still states this; Overview must not inject a stage-0 nav item.
    expect(SRC).not.toMatch(/stage:\s*["']overview["']/);
    expect(SRC).toMatch(/Overview is not a stage|not a stage|surface:\s*["']overview["']/);
  });
});

describe("IA-6 Dashboard continuation contract", () => {
  it("uses ProjectContinuationCard for project list", () => {
    expect(DASHBOARD).toMatch(/ProjectContinuationCard/);
    expect(DASHBOARD).not.toMatch(/from "@\/components\/ProjectCard"/);
  });
});

describe("IA-6 Photos residual — no legacy estimate/report Complete", () => {
  it("upload shell no longer spreads progressFromProjectFlags", () => {
    expect(UPLOAD).not.toMatch(/progressFromProjectFlags/);
    expect(UPLOAD).toMatch(/estimateDone:\s*false/);
    expect(UPLOAD).toMatch(/reportDone:\s*false/);
  });
});
