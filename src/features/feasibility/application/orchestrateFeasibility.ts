import { runVisionThenScope } from "@/core/ai";
import { hasProAccess } from "@/features/payment";
import { auth } from "@/lib/auth";
import type { FeasibilityStudy } from "../domain";
import { isFeasibilityStudyComplete } from "../domain";
import type {
  CreateFeasibilityStudyCommand,
  EstimateCapability,
  ExportCapability,
  FeasibilityRepository,
  OrchestrateFeasibilityResult,
  PhotoAnalysisCapability,
  RoiCapability,
  ScopeCapability,
} from "./ports";

export type OrchestrateFeasibilityDeps = {
  repository: FeasibilityRepository;
  analysisAgent: PhotoAnalysisCapability;
  scopeAgent: ScopeCapability;
  estimateAgent: EstimateCapability;
  roiAgent: RoiCapability;
  exportService?: ExportCapability;
};

export function makeOrchestrateFeasibility({
  repository,
  analysisAgent,
  scopeAgent,
  estimateAgent,
  roiAgent,
  exportService,
}: OrchestrateFeasibilityDeps) {
  return async function createFeasibilityStudy(
    input: CreateFeasibilityStudyCommand,
  ): Promise<OrchestrateFeasibilityResult> {
    const roomAnalysesPromise = analysisAgent.analyzePhotos({
      projectId: input.projectId,
      photos: input.photos,
    });

    const scopePromise = roomAnalysesPromise
      .then((roomAnalyses) =>
        scopeAgent.generateFromAnalysis({
          projectId: input.projectId,
          photos: input.photos,
          roomAnalyses,
          scopeInput: input.scopeInput,
        }),
      )
      .catch(async () =>
        runVisionThenScope({
          projectId: input.projectId,
          photos: input.photos,
          ...input.scopeInput,
        }),
      );

    const [roomAnalyses, scope] = await Promise.all([roomAnalysesPromise, scopePromise]);

    const estimate = await estimateAgent.generateEstimate(input.estimateInput);
    const roi = await roiAgent.generateReport({
      ...input.roiInput,
      refurb_budget: estimate.mid_total,
    });
    const exports = exportService ? await exportService.listProjectExports(input.projectId) : [];

    const now = new Date();
    const study: FeasibilityStudy = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      property: input.property,
      roomAnalyses,
      scope,
      estimate,
      roi,
      exports,
      status: "draft",
      metadata: {
        version: 1,
        lastComputedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };

    if (isFeasibilityStudyComplete(study)) {
      study.status = "complete";
    }

    const studySnapshot = await repository.saveSnapshot(study);

    if (exportService && hasProAccess(auth.getUser())) {
      await exportService.queueFeasibilityReport(study.id);
    }

    return {
      studySnapshot,
      study,
      roomAnalyses,
      scope,
      estimate,
      roi,
    };
  };
}
