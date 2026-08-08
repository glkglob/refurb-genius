/**
 * IA-4 invariant: first-class Redesign route + single authority.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("IA-4 first-class redesign route file exists", () => {
  assert.equal(existsSync(join(ROOT, "src/routes/_authed/projects.$id.redesign.tsx")), true);
});

test("IA-4 stage destination and resolver use /projects/$id/redesign", () => {
  const stages = read("src/features/projects/domain/workflowStages.ts");
  assert.match(stages, /\/projects\/\$id\/redesign/);
  assert.doesNotMatch(stages, /kind:\s*"embedded"/);

  const resolver = read("src/features/projects/domain/resolveProjectNextAction.ts");
  assert.match(resolver, /\/projects\/\$\{id\}\/redesign/);
  assert.doesNotMatch(resolver, /analysis\?focus=redesign/);
});

test("IA-4 Analysis converges focus=redesign and continues to /redesign", () => {
  const analysis = read("src/routes/_authed/projects.$id.analysis.tsx");
  assert.match(analysis, /beforeLoad/);
  assert.match(analysis, /redirect/);
  assert.match(analysis, /\/projects\/\$id\/redesign/);
  // No competing embedded Redesign grid authority.
  assert.doesNotMatch(analysis, /project-redesign/);
  assert.doesNotMatch(analysis, /generateRedesignConcepts\s*\(/);
});

test("IA-4 redesign adapter is pure and exported", () => {
  const adapter = read("src/features/projects/domain/redesignWorkflowAdapter.ts");
  assert.match(adapter, /redesignCurrencyFromEvidence/);
  assert.match(adapter, /hasUnselectedCandidates/);
  assert.doesNotMatch(adapter, /from ["']react["']/);
  assert.doesNotMatch(adapter, /from ["']@supabase\//);

  const pub = read("src/features/projects/index.ts");
  assert.match(pub, /redesignCurrencyFromEvidence/);
});

test("IA-4-R1 selection uses atomic RPC and canonical columns", () => {
  const repo = read(
    "src/features/ai-design/infrastructure/repositories/redesign-concepts.repository.server.ts",
  );
  assert.match(repo, /redesign_concepts/);
  assert.match(repo, /select_project_redesign_concept/);
  assert.match(repo, /analysis_identity/);
  assert.match(repo, /is_selected/);
  assert.match(repo, /server-only/);
  // Old sequential multi-update selection algorithm must not remain.
  assert.doesNotMatch(repo, /clear prior redesign selection/);

  const migration = read("supabase/migrations/20260807220000_ia4_atomic_redesign_selection.sql");
  assert.match(migration, /redesign_concepts_one_selected_per_project/);
  assert.match(migration, /select_project_redesign_concept/);
  assert.match(migration, /FOR UPDATE/);
});

test("IA-4-R3 live redesign_concepts shape is committed before R1/R2", () => {
  const reconcile = read(
    "supabase/migrations/20260807210000_reconcile_redesign_concepts_live_shape.sql",
  );
  assert.match(reconcile, /ADD COLUMN IF NOT EXISTS title/);
  assert.match(reconcile, /ADD COLUMN IF NOT EXISTS description/);
  assert.match(reconcile, /payload/);
  // Ordering: reconcile filename is strictly before R1 and R2 migrations.
  const names = [
    "20260807210000_reconcile_redesign_concepts_live_shape.sql",
    "20260807220000_ia4_atomic_redesign_selection.sql",
    "20260807230000_ia4_redesign_authority_write_path_seal.sql",
  ];
  assert.deepEqual([...names].sort(), names);
});

test("IA-4-R2 write path sealed via DEFINER RPCs and DML revoke", () => {
  const repo = read(
    "src/features/ai-design/infrastructure/repositories/redesign-concepts.repository.server.ts",
  );
  assert.match(repo, /replace_project_redesign_candidates/);
  assert.match(repo, /select_project_redesign_concept/);
  // Generation must not direct-insert authority rows after seal.
  assert.doesNotMatch(repo, /\.from\("redesign_concepts"\)\.insert/);
  assert.doesNotMatch(repo, /\.from\("redesign_concepts"\)\s*\n?\s*\.delete/);

  const seal = read(
    "supabase/migrations/20260807230000_ia4_redesign_authority_write_path_seal.sql",
  );
  assert.match(seal, /SECURITY DEFINER/);
  assert.match(seal, /replace_project_redesign_candidates/);
  assert.match(seal, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE/);
  assert.match(seal, /select_project_redesign_concept/);
  assert.match(seal, /GRANT SELECT ON TABLE public\.redesign_concepts TO authenticated/);
});

test("IA-5-R4A redesign UI wires generate+select through sealed server authority", () => {
  const page = read("src/routes/_authed/projects.$id.redesign.tsx");
  assert.match(page, /generateRedesignConceptsServerFn/);
  assert.match(page, /selectRedesignConceptServerFn/);
  assert.match(page, /listRedesignConceptsServerFn/);
  assert.match(page, /data-testid=["']redesign-generate["']/);
  assert.match(page, /generate concepts from current Analysis/);
  assert.match(page, /Select Redesign/);
  // Generation alone never Completes — user must select.
  assert.match(page, /generation alone[\s\S]*does not advance the workflow/i);
  assert.doesNotMatch(page, /redesign_done\s*=\s*true/);

  const server = read("src/features/ai-design/presentation/serverFns.ts");
  assert.match(server, /resolveCurrentProjectAnalysisAuthority/);
  assert.match(server, /replaceRedesignCandidates/);
  assert.match(server, /selectDurableRedesignConcept/);
});
