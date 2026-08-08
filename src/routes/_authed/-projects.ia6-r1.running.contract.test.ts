/**
 * IA-6-R1 — source contracts: stage routes publish running; five-stage hook consumes.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../..");
const analysis = readFileSync(join(__dirname, "projects.$id.analysis.tsx"), "utf8");
const redesign = readFileSync(join(__dirname, "projects.$id.redesign.tsx"), "utf8");
const upload = readFileSync(join(__dirname, "projects.$id.upload.tsx"), "utf8");
const hook = readFileSync(
  join(root, "features/projects/presentation/hooks/useProjectFiveStageWorkflow.ts"),
  "utf8",
);

describe("IA-6-R1 running signal contracts", () => {
  it("Analysis publishes withProjectWorkflowOperationRunning", () => {
    expect(analysis).toMatch(/withProjectWorkflowOperationRunning/);
    expect(analysis).toMatch(/"analysis"/);
  });

  it("Redesign publishes withProjectWorkflowOperationRunning", () => {
    expect(redesign).toMatch(/withProjectWorkflowOperationRunning/);
    expect(redesign).toMatch(/"redesign"/);
  });

  it("Photos upload publishes withProjectWorkflowOperationRunning", () => {
    expect(upload).toMatch(/withProjectWorkflowOperationRunning/);
    expect(upload).toMatch(/"photos"/);
  });

  it("useProjectFiveStageWorkflow forwards operation flags into compose", () => {
    expect(hook).toMatch(/useProjectWorkflowOperationFlags/);
    expect(hook).toMatch(/analysisOperationRunning:\s*operationFlags\.analysisOperationRunning/);
    expect(hook).toMatch(/redesignOperationRunning:\s*operationFlags\.redesignOperationRunning/);
    expect(hook).toMatch(/photosOperationRunning:\s*operationFlags\.photosOperationRunning/);
  });
});
