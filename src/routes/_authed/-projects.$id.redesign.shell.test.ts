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

const GENERATE = readFileSync(
  join(
    process.cwd(),
    "src/features/ai-design/infrastructure/runAuthenticatedRedesignGeneration.server.ts",
  ),
  "utf8",
);

const GENERATE_CLIENT = readFileSync(
  join(process.cwd(), "src/features/ai-design/presentation/generateRedesignConceptsForClient.ts"),
  "utf8",
);

const SELECT_CLIENT = readFileSync(
  join(process.cwd(), "src/features/ai-design/presentation/selectRedesignConceptForClient.ts"),
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
  it("imports canonical generation, list, and selection client boundaries", () => {
    expect(SRC).toMatch(/generateRedesignConceptsForClient/);
    expect(SRC).toMatch(/listRedesignConceptsForClient/);
    expect(SRC).toMatch(/selectRedesignConceptForClient/);
    expect(SRC).toMatch(/from ["']@\/features\/ai-design["']/);
    expect(SRC).not.toMatch(/generateRedesignConceptsServerFn/);
    expect(SRC).not.toMatch(/selectRedesignConceptServerFn/);
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

  it("handleGenerate requires current Analysis and calls the platform generate boundary", () => {
    expect(SRC).toMatch(/isProductionValidAnalysisSet/);
    expect(SRC).toMatch(/Current Analysis is required before generating Redesign/);
    expect(SRC).toMatch(/generateRedesignConceptsForClient\(\{\s*projectId:\s*id\s*\}\)/);
    expect(GENERATE_CLIENT).toMatch(/generateRedesignConceptsServerFn/);
    expect(GENERATE_CLIENT).toMatch(/generateRedesignConceptsNative/);
  });

  it("generation alone does not Complete — select_redesign required", () => {
    expect(SRC).toMatch(/generation alone[\s\S]*does not advance the workflow/i);
    expect(SRC).toMatch(/select_redesign/);
    expect(SRC).toMatch(/Select Redesign/);
    // Shell Complete flags come only from redesign currency adapter
    expect(SRC).toMatch(/redesignShellFlagsFromCurrency/);
    expect(SRC).toMatch(/redesignCurrencyFromEvidence/);
  });

  it("handleSelect uses the platform selection boundary", () => {
    expect(SRC).toMatch(/selectRedesignConceptForClient/);
    expect(SRC).toMatch(/projectId:\s*id/);
    expect(SRC).toMatch(/conceptId/);
    expect(SRC).toMatch(/data-testid=["']redesign-candidates["']/);
    expect(SELECT_CLIENT).toMatch(/selectRedesignConceptServerFn/);
    expect(SELECT_CLIENT).toMatch(/selectRedesignConceptNative/);
  });

  it("reload hydrates candidates from durable list, not mutation-only memory", () => {
    expect(SRC).toMatch(/listRedesignConceptsForClient/);
    expect(SRC).toMatch(/setCandidates\(durable/);
    expect(SRC).toMatch(/loadPhotoAnalysis/);
  });

  it("IA-4 Redesign gate still uses durable photo/Analysis reads (P1)", () => {
    expect(SRC).toMatch(/usePhotos/);
    expect(SRC).toMatch(/loadPhotoAnalysis/);
    expect(SRC).toMatch(/isProductionValidAnalysisSet/);
    expect(SRC).toMatch(/buildPhotosAnalysisWorkflowState/);
    expect(SRC).toMatch(/photosAnalysisWorkflow\.analysis\.currency !== ["']current["']/);
    expect(SRC).toMatch(/Analysis has changed/);
  });

  it("T29: live grid uses current-concept selector, not raw isSelected dump", () => {
    expect(SRC).toMatch(/selectCurrentRedesignConcepts/);
    expect(SRC).toMatch(/currentSelectedRedesignConcept/);
    expect(SRC).toMatch(/currentConcepts\.map/);
    expect(SRC).toMatch(/selected=\{currentSelected\?\.id === c\.id\}/);
    expect(SRC).toMatch(/data-testid=["']redesign-candidates["']/);
  });

  it("T30: recovery copy tells the user Analysis has changed", () => {
    expect(SRC).toMatch(/Analysis has changed/);
    expect(SRC).toMatch(/Re-run Analysis before generating Redesign concepts/);
  });

  it("T31: select handler refuses non-current concepts", () => {
    expect(SRC).toMatch(/isCurrentRedesignConcept/);
    expect(SRC).toMatch(/This concept is from a previous Analysis/);
  });

  it("T32: reload follows catalogue identity, not analyses.length === 0 only", () => {
    expect(SRC).toMatch(/durablePhotoCatalogueIdentity/);
    expect(SRC).toMatch(/subscribePhotoAnalysis/);
    expect(SRC).toMatch(/preferAnalysesForCurrentCatalogue/);
    expect(SRC).not.toMatch(/analyses\.length === 0 && catalogue\.length > 0/);
  });

  it("server generation resolves Analysis authority then persists via replace RPC", () => {
    expect(SERVER).toMatch(/runAuthenticatedRedesignGeneration/);
    expect(SERVER).toMatch(/void data\.analyses/);
    expect(GENERATE).toMatch(/resolveCurrentProjectAnalysisAuthorityWithClient/);
    expect(GENERATE).toMatch(/runSecureRedesignGeneration/);
    expect(GENERATE).toMatch(/replaceRedesignCandidatesWithClient/);
    expect(GENERATE).toMatch(/rateLimitKeyForUser\([^,]+,\s*["']ai-redesign["']\)/);
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
