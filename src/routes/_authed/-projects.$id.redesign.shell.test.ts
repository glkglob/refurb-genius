/**
 * IA-5-R4A — Redesign product path shell contract.
 *
 * Locks generate → durable candidates → explicit select → Complete.
 * Generation alone must never mark Redesign Complete.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(
  join(process.cwd(), "src/routes/_authed/projects.$id.redesign.tsx"),
  "utf8",
);

const SERVER = readFileSync(
  join(process.cwd(), "src/features/ai-design/presentation/serverFns.ts"),
  "utf8",
);

const REPO = readFileSync(
  join(
    process.cwd(),
    "src/features/ai-design/infrastructure/repositories/redesign-concepts.repository.server.ts",
  ),
  "utf8",
);

describe("IA-5-R4A Redesign product generation and selection contract", () => {
  it("imports canonical generation, list, and selection serverFns", () => {
    expect(SRC).toMatch(/generateRedesignConceptsServerFn/);
    expect(SRC).toMatch(/listRedesignConceptsServerFn/);
    expect(SRC).toMatch(/selectRedesignConceptServerFn/);
    expect(SRC).toMatch(/from ["']@\/features\/ai-design["']/);
  });

  it("generate CTA is discoverable as Create Redesign and Generate concepts", () => {
    // Visible resolver label
    expect(SRC).toMatch(/primaryLabel/);
    expect(SRC).toMatch(/create_redesign|update_redesign/);
    // Automation / a11y: Generate must resolve to the same generate handler
    expect(SRC).toMatch(/generate concepts from current Analysis/);
    expect(SRC).toMatch(/data-testid=["']redesign-generate["']/);
    expect(SRC).toMatch(/handleGenerate/);
  });

  it("handleGenerate requires current Analysis and calls generation serverFn", () => {
    expect(SRC).toMatch(/isProductionValidAnalysisSet/);
    expect(SRC).toMatch(/Current Analysis is required before generating Redesign/);
    expect(SRC).toMatch(
      /generateRedesignConceptsServerFn\(\{\s*data:\s*\{\s*projectId:\s*id\s*\}\s*\}\)/,
    );
  });

  it("generation alone does not Complete — select_redesign required", () => {
    expect(SRC).toMatch(/generation alone[\s\S]*does not advance the workflow/i);
    expect(SRC).toMatch(/select_redesign/);
    expect(SRC).toMatch(/Select Redesign/);
    // Shell Complete flags come only from redesign currency adapter
    expect(SRC).toMatch(/redesignShellFlagsFromCurrency/);
    expect(SRC).toMatch(/redesignCurrencyFromEvidence/);
  });

  it("handleSelect uses canonical selection serverFn only", () => {
    expect(SRC).toMatch(/selectRedesignConceptServerFn/);
    expect(SRC).toMatch(/projectId:\s*id/);
    expect(SRC).toMatch(/conceptId/);
    expect(SRC).toMatch(/data-testid=["']redesign-candidates["']/);
  });

  it("reload hydrates candidates from durable list, not mutation-only memory", () => {
    expect(SRC).toMatch(/listRedesignConceptsServerFn/);
    expect(SRC).toMatch(/setCandidates\(durable/);
    expect(SRC).toMatch(/loadPhotoAnalysis/);
  });

  it("serverFn resolves Analysis authority server-side then persists via replace RPC", () => {
    expect(SERVER).toMatch(/resolveCurrentProjectAnalysisAuthority/);
    expect(SERVER).toMatch(/runSecureRedesignGeneration/);
    expect(SERVER).toMatch(/replaceRedesignCandidates/);
    expect(SERVER).toMatch(/void data\.analyses/);
    expect(REPO).toMatch(/replace_project_redesign_candidates/);
    expect(REPO).toMatch(/select_project_redesign_concept/);
    expect(REPO).not.toMatch(/\.from\("redesign_concepts"\)\.insert/);
  });

  it("does not mark Complete from local mutation without selection", () => {
    // No local redesign_done = true after generate
    expect(SRC).not.toMatch(/redesign_done\s*=\s*true/);
    expect(SRC).not.toMatch(/setRedesignDone/);
  });
});
