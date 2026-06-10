import { runPricingEngine } from "@repo/services";
import type {
  EstimateCapability,
  ExportCapability,
  PhotoAnalysisCapability,
  ScopeCapability,
} from "../../application";
import type { RoiCapability } from "../../application";
import { runPhotoAnalysisServerFn } from "@/features/ai-upload";
import { runScopeAnalysisServerFn } from "@/features/ai-design";
import { makeRoiService } from "@/features/roi";
import { deterministicRoiEngine } from "@/features/roi/infrastructure";
import { supabaseExportRepository } from "@/features/export/infrastructure";
import { supabase } from "@/platform/supabase/browser";
import { auth } from "@/lib/auth";

export const photoAnalysisCapability: PhotoAnalysisCapability = {
  analyzePhotos(input) {
    return runPhotoAnalysisServerFn({ data: input });
  },
};

export const scopeCapability: ScopeCapability = {
  analyzeScope(input) {
    return runScopeAnalysisServerFn({ data: input });
  },
  async generateFromAnalysis(input) {
    const roomTags = Array.from(
      new Set([
        ...input.scopeInput.roomTags,
        ...input.roomAnalyses.map((analysis) => analysis.room_type),
      ]),
    );

    const notes = [
      input.scopeInput.notes ?? "",
      `Vision context: ${input.roomAnalyses
        .slice(0, 6)
        .map((analysis) => `${analysis.room_type} (${analysis.condition_level})`)
        .join(" | ")}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    return runScopeAnalysisServerFn({
      data: {
        ...input.scopeInput,
        projectId: input.projectId,
        photos: input.photos,
        roomTags,
        notes,
      },
    });
  },
};

export const estimateCapability: EstimateCapability = {
  async generateEstimate(input) {
    return runPricingEngine(input);
  },
};

const roiService = makeRoiService({ engine: deterministicRoiEngine });

export const roiCapability: RoiCapability = {
  generateReport(input) {
    return roiService.generateRoiReport({ inputs: input });
  },
};

export const emptyExportCapability: ExportCapability = {
  async listProjectExports(projectId) {
    const user = auth.getUser();
    if (!user) return [];

    const { data: studies, error: studiesError } = await supabase
      .from("feasibility_studies")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", user.id);

    if (studiesError) throw new Error(studiesError.message);
    const studyIds = (studies ?? []).map((study) => study.id);
    if (studyIds.length === 0) return [];

    const { data: exports, error: exportsError } = await supabase
      .from("study_exports")
      .select("*")
      .in("study_id", studyIds)
      .order("queued_at", { ascending: false });

    if (exportsError) throw new Error(exportsError.message);

    return (exports ?? []).map((record) => ({
      type: record.export_type as "project-report" | "pitch-deck" | "feasibility-study",
      filename: record.storage_path ?? `${record.export_type}-${record.study_id}`,
      storagePath: record.storage_path ?? undefined,
      generatedAt: record.completed_at ?? record.queued_at,
    }));
  },
  async queueFeasibilityReport(studyId) {
    await supabaseExportRepository.queueFeasibilityStudyExport({ studyId });
  },
};
