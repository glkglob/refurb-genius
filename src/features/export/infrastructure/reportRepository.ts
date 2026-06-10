import type {
  ExportRepositoryPort,
  SavePitchDeckExportInput,
  SavePitchDeckExportResult,
} from "../application";

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
}

export const supabaseExportRepository: ExportRepositoryPort = new SupabaseExportRepository();
