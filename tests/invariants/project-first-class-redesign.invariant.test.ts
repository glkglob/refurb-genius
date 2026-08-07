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

test("IA-4 selection persistence uses existing redesign_concepts table", () => {
  const repo = read(
    "src/features/ai-design/infrastructure/repositories/redesign-concepts.repository.server.ts",
  );
  assert.match(repo, /redesign_concepts/);
  assert.match(repo, /isSelected/);
  assert.match(repo, /analysisIdentity/);
  assert.match(repo, /description/);
  assert.match(repo, /server-only/);
  // Live columns + description JSON authority (no schema migration).
  assert.match(repo, /No schema migration/);
});
