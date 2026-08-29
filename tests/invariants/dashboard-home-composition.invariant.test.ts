/**
 * Dashboard Home composition — Brief then Board, no featured My projects.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const ROUTE = "src/routes/_authed/dashboard.tsx";
const HOOK = "src/features/projects/presentation/hooks/useDashboardProjectSummaries.ts";
const VISIBILITY = "src/features/projects/presentation/hooks/useProjectBriefVisibility.ts";
const BRIEF = "src/features/projects/presentation/components/ProjectBrief.tsx";
const BOARD = "src/features/projects/presentation/components/WorkflowBoard.tsx";

function read(relative: string): string {
  const full = join(ROOT, relative);
  assert.ok(existsSync(full), `missing ${relative}`);
  return readFileSync(full, "utf8");
}

test("dashboard Home heading is CSS-responsive Home/Dashboard", () => {
  const src = read(ROUTE);
  assert.match(src, /lg:hidden">Home</);
  assert.match(src, /hidden lg:inline">Dashboard</);
  assert.match(src, /See what needs attention across your refurbishment projects/);
  assert.match(src, /Dashboard — Refurb Genius/);
  assert.equal(src.match(/<h1[\s\S]*?<\/h1>/g)?.length, 1);
});

test("dashboard Home renders Project Brief before Workflow Board", () => {
  const src = read(ROUTE);
  assert.match(src, /ProjectBrief/);
  assert.match(src, /WorkflowBoard/);
  assert.ok(src.indexOf("ProjectBrief") < src.indexOf("WorkflowBoard"));
});

test("dashboard Home does not use My projects, featured hierarchy, or continuation cards", () => {
  const src = read(ROUTE);
  assert.doesNotMatch(src, /My projects/);
  assert.doesNotMatch(src, /Continue where you left off/);
  assert.doesNotMatch(src, /Other projects/);
  assert.doesNotMatch(src, /ProjectContinuationCard/);
  assert.doesNotMatch(src, /layout="featured"/);
  assert.doesNotMatch(src, /useProjectFiveStageWorkflow/);
  assert.doesNotMatch(src, /photos_done|analysis_done|estimate_done|report_done/);
});

test("dashboard Home evidence orchestration does not swallow errors", () => {
  const hook = read(HOOK);
  assert.doesNotMatch(hook, /\.catch\(\s*\(\)\s*=>\s*\[\]/);
  assert.doesNotMatch(hook, /\.catch\(\s*\(\)\s*=>\s*null/);
  assert.doesNotMatch(hook, /useProjectFiveStageWorkflow/);
  assert.match(hook, /useQueries/);
});

test("dashboard Home is read-only and keeps the Copilot rail and route", () => {
  const src = read(ROUTE);
  const board = read(BOARD);
  const brief = read(BRIEF);
  assert.match(src, /showDealCopilotRail/);
  assert.match(src, /createFileRoute\("\/_authed\/dashboard"\)/);
  assert.doesNotMatch(src, /useSetProjectStage|draggable|onDrop/);
  assert.doesNotMatch(board, /useSetProjectStage|draggable|onDrop/);
  assert.doesNotMatch(brief, /useSetProjectStage|draggable|onDrop/);
  assert.doesNotMatch(src, /\.from\s*\(/);
  assert.doesNotMatch(src, /@\/platform\/supabase/);
});

test("dashboard and Projects presentation do not introduce remote editorial fonts", () => {
  const css = read("src/styles.css");
  const route = read(ROUTE);
  const brief = read(BRIEF);
  const board = read(BOARD);
  const card = read("src/features/projects/presentation/components/ProjectContinuationCard.tsx");
  const rail = read("src/components/DealCopilotRail.tsx");
  assert.doesNotMatch(css, /fonts\.googleapis\.com/);
  assert.match(css, /Cormorant Garamond/);
  assert.doesNotMatch(css, /--font-editorial/);
  assert.doesNotMatch(route, /font-editorial/);
  assert.doesNotMatch(brief, /font-editorial/);
  assert.doesNotMatch(board, /font-editorial/);
  assert.doesNotMatch(card, /font-editorial/);
  assert.doesNotMatch(rail, /font-editorial/);
  assert.match(css, /Inter Variable/);
});

test("dashboard visual chrome stays compact without KPIs, chips, or overflow", () => {
  const brief = read(BRIEF);
  const board = read(BOARD);
  const item = read("src/features/projects/presentation/components/WorkflowBoardItem.tsx");
  const route = read(ROUTE);
  assert.doesNotMatch(
    brief,
    /brief-count-attention|brief-count-progress|brief-count-ready|brief-count-complete/,
  );
  assert.doesNotMatch(brief, /grid-cols-4/);
  assert.doesNotMatch(board, /overflow-x-auto/);
  assert.match(board, /View all projects/);
  assert.match(board, /href=["']\/projects["']/);
  assert.doesNotMatch(board, /search=\{/);
  assert.match(item, /WorkflowStageProgress/);
  assert.doesNotMatch(item, /reasonExplanation/);
  assert.match(route, /project-brief-restore/);
  assert.doesNotMatch(route, /variant="outline"[\s\S]*project-brief-restore/);
});

test("dashboard brief visibility key is user-scoped", () => {
  const src = read(VISIBILITY);
  assert.match(src, /refurb-genius:dashboard:project-brief-visible:v1:/);
  assert.doesNotMatch(
    src,
    /localStorage\.(get|set)Item\(\s*["']refurb-genius:dashboard:project-brief-visible["']/,
  );
  assert.match(src, /resolvedUserId !== currentUserId/);
});
