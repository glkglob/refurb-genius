/**
 * Presentation-safe PitchDeckGenerator orchestration (AO-1M2).
 *
 * Owns:
 * - auth.getUser gate
 * - multi-query project data acquisition (existing factories)
 * - PDF generation via export PdfExporterPort
 * - browser download
 * - optional cloud save via ExportRepositoryPort
 * - pitch-deck history invalidation (canonical key)
 * - success / info / error toasts and pipeline logging
 * - progress + pending for the full generate→download→save pipeline
 *
 * Persistence implementation: SupabaseExportRepository (export infrastructure port).
 * PDF layout: LegacyPdfExporter / existing PDF generator (unchanged).
 * Does not redesign PDF content, query factories, or adjacent AO-1 residuals.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import type { ProjectWithProgress } from "@/lib/mappers";
import type { Financials } from "@/lib/queries/projects";
import {
  financialsQueryOptions,
  photosQueryOptions,
  projectQueryOptions,
} from "@/lib/queries/projects";
import { estimateQueryOptions } from "@/lib/queries/projects";
import { photoAnalysisByProjectQueryOptions } from "@/lib/queries/photo-analysis";
import { pitchDecksByProjectQueryOptions } from "@/lib/queries/pitch-decks";
import { floorplansByProjectQueryOptions } from "@/lib/queries/floorplans";
import type { PersistedRoomEstimate } from "@/features/estimate";
import type { ProjectPhoto } from "@/lib/photos-types";
import type { PhotoAnalysisResultRow } from "@/lib/queries/photo-analysis";
import { buildExportMetadata } from "../../domain";
import { legacyPdfExporter, supabaseExportRepository } from "../../infrastructure";

export type UseGenerateAndSavePitchDeckOptions = {
  projectId: string;
  project?: ProjectWithProgress | null;
};

export type UseGenerateAndSavePitchDeckResult = {
  generatePitchDeck: () => Promise<void>;
  isPending: boolean;
  progress: number;
  progressStage: string;
};

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useGenerateAndSavePitchDeck(
  options: UseGenerateAndSavePitchDeckOptions,
): UseGenerateAndSavePitchDeckResult {
  const { projectId, project: projectProp } = options;
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const scheduleReset = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setIsPending(false);
      setProgress(0);
      setProgressStage("");
      runningRef.current = false;
    }, 600);
  }, []);

  const generatePitchDeck = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsPending(true);
    setProgress(0);
    setProgressStage("Fetching data...");

    const user = auth.getUser();
    if (!user) {
      toast.error("You must be signed in to generate a pitch deck.");
      setIsPending(false);
      runningRef.current = false;
      return;
    }

    try {
      const [projData, finData, photosData, estData, analysesData, floorplansData] =
        await Promise.all([
          projectProp || queryClient.fetchQuery(projectQueryOptions(projectId)),
          queryClient.fetchQuery(financialsQueryOptions(projectId)),
          queryClient.fetchQuery(photosQueryOptions(projectId)),
          queryClient.fetchQuery(estimateQueryOptions(projectId)),
          queryClient.fetchQuery(photoAnalysisByProjectQueryOptions(projectId)),
          queryClient.fetchQuery(floorplansByProjectQueryOptions(projectId)),
        ]);

      const project = (projData as ProjectWithProgress) || projectProp;
      if (!project) throw new Error("Project data not available.");

      setProgress(30);
      setProgressStage("Building PDF content...");

      const generated = await legacyPdfExporter.exportPitchDeck({
        type: "pitch-deck",
        filenamePrefix: "pitch-deck",
        data: {
          project,
          financials: finData as Financials | null,
          estimate: estData as PersistedRoomEstimate | null,
          photos: photosData as ProjectPhoto[],
          analyses: analysesData as PhotoAnalysisResultRow[],
          floorplanModels: (floorplansData as Array<{ id: string; name: string }>) ?? [],
        },
        options: {
          onProgress: (stage, pct) => {
            setProgressStage(stage);
            if (pct) setProgress(30 + Math.min(pct, 40));
          },
          includePhotos: true,
          include3D: true,
          includeSensitivity: true,
        },
        metadata: buildExportMetadata({
          reportType: "pitch-deck",
          projectId,
        }),
      });

      if (!generated.blob || generated.pageCount == null) {
        throw new Error("Pitch deck PDF generation did not return a blob.");
      }

      const { blob, filename, pageCount } = generated;

      setProgress(75);
      setProgressStage("Downloading PDF...");

      downloadBlob(blob, filename);

      toast.success("Pitch deck generated", {
        description: `${filename} (${pageCount} pages) — downloaded.`,
      });

      setProgressStage("Saving to cloud (optional)...");
      setProgress(85);

      try {
        const { recordId } = await supabaseExportRepository.savePitchDeckExport({
          projectId,
          userId: user.id,
          blob,
          filename,
          pageCount,
        });

        await queryClient.invalidateQueries({
          queryKey: pitchDecksByProjectQueryOptions(projectId).queryKey,
        });

        toast.success("Saved to your project", {
          description: "Pitch deck record added. View history in app settings or reports.",
        });

        logger.info("[pitch-deck] saved to Supabase", { projectId, recordId });
      } catch (saveErr) {
        logger.warn("[pitch-deck] cloud save failed (PDF downloaded anyway)", {
          error: (saveErr as Error).message,
        });
        toast.info("PDF downloaded. Cloud save skipped (check permissions or try again).");
      }

      setProgress(100);
      setProgressStage("Complete");
    } catch (err: unknown) {
      logger.error("[pitch-deck] generation failed", {
        projectId,
        error: (err as Error)?.message || err,
      });
      toast.error("Failed to generate pitch deck", {
        description:
          (err instanceof Error ? err.message : null) || "Please try again or contact support.",
      });
    } finally {
      scheduleReset();
    }
  }, [projectId, projectProp, queryClient, scheduleReset]);

  return {
    generatePitchDeck,
    isPending,
    progress,
    progressStage,
  };
}
