import type {
  ExportRepositoryPort,
  QueueFeasibilityStudyExportInput,
  SaveFeasibilityStudyExportInput,
  SavePitchDeckExportInput,
  SavePitchDeckExportResult,
} from "../application";
import { auth } from "@/lib/auth";
import { supabase } from "@/platform/supabase/browser";

export class SupabaseExportRepository implements ExportRepositoryPort {
  async savePitchDeckExport(input: SavePitchDeckExportInput): Promise<SavePitchDeckExportResult> {
    const { savePitchDeckToSupabase } = await import("@/lib/pitchDeck");
    const { record, storagePath } = await savePitchDeckToSupabase(
      input.projectId,
      input.userId,
      input.blob,
      input.filename,
      input.pageCount,
    );

    return {
      storagePath,
      recordId: typeof record?.id === "string" ? record.id : undefined,
    };
  }

  async queueFeasibilityStudyExport(input: QueueFeasibilityStudyExportInput): Promise<void> {
    const user = auth.getUser();
    const userId = input.userId ?? user?.id;
    if (!userId) throw new Error("A user must be signed in to queue feasibility exports.");

    const { error } = await supabase.from("study_exports").insert({
      study_id: input.studyId,
      user_id: userId,
      export_type: "feasibility-study",
      status: "queued",
    });

    if (error) throw new Error(error.message);
  }

  async saveFeasibilityStudyExport(input: SaveFeasibilityStudyExportInput): Promise<void> {
    const user = auth.getUser();
    const userId = input.userId ?? user?.id;
    if (!userId) throw new Error("A user must be signed in to save feasibility exports.");

    const { error } = await supabase.from("study_exports").insert({
      study_id: input.studyId,
      user_id: userId,
      export_type: "feasibility-study",
      status: "completed",
      storage_path: input.filename,
      completed_at: new Date().toISOString(),
      error_message: null,
    });

    if (error) throw new Error(error.message);
  }
}

export const supabaseExportRepository: ExportRepositoryPort = new SupabaseExportRepository();
