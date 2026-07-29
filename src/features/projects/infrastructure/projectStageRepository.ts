/**
 * Project stage progress persistence (AO-1M4).
 *
 * Browser Supabase update of a single *_done column on public.projects.
 * Ownership enforced by RLS (projects_all_own). No select/return row.
 */
import { supabase } from "@/platform/supabase/browser";
import type { ProjectStage } from "@/core/projects/domain";

export interface SetProjectStageDoneInput {
  projectId: string;
  stage: ProjectStage;
  value: boolean;
}

/**
 * Maps workflow stage name → projects table progress column patch.
 * Preserves pre-extraction ternary fall-through for non-matching stages.
 */
function stageColumnPatch(
  stage: ProjectStage,
  value: boolean,
):
  | { photos_done: boolean }
  | { analysis_done: boolean }
  | { estimate_done: boolean }
  | { report_done: boolean } {
  return stage === "photos"
    ? { photos_done: value }
    : stage === "analysis"
      ? { analysis_done: value }
      : stage === "estimate"
        ? { estimate_done: value }
        : { report_done: value };
}

/**
 * Update a single project stage progress flag for the authenticated owner.
 * Preserves pre-extraction table, filter, void return, and error behaviour.
 */
export async function setProjectStageDone(input: SetProjectStageDoneInput): Promise<void> {
  const { projectId, stage, value } = input;
  const column = stageColumnPatch(stage, value);
  const { error } = await supabase.from("projects").update(column).eq("id", projectId);
  if (error) throw new Error(error.message);
}

export const projectStageRepository = {
  setProjectStageDone,
};
