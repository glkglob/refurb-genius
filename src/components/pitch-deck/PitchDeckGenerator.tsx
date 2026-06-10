"use client";

import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@repo/ui";
import { Progress } from "@repo/ui";
import { FileText, Loader2, Download, Save } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { generatePitchDeckPDF, savePitchDeckToSupabase } from "@/lib/pitchDeck";
import {
  projectQueryOptions,
  financialsQueryOptions,
  photosQueryOptions,
} from "@/lib/queries/projects";
import { estimateQueryOptions } from "@/lib/queries/projects";
import { photoAnalysisByProjectQueryOptions } from "@/lib/queries/photo-analysis";
import { pitchDecksByProjectQueryOptions } from "@/lib/queries/pitch-decks";
import { floorplansByProjectQueryOptions } from "@/lib/queries/floorplans";
import type { ProjectWithProgress } from "@/lib/mappers";
import type { Financials } from "@/lib/queries/projects";
import type { PersistedRoomEstimate } from "@/features/estimate/infrastructure";
import type { ProjectPhoto } from "@/lib/photos";
import type { PhotoAnalysisResultRow } from "@/lib/queries/photo-analysis";

interface PitchDeckGeneratorProps {
  projectId: string;
  project?: ProjectWithProgress;
  trigger?: "header" | "financials";
}

export function PitchDeckGenerator({
  projectId,
  project: projectProp,
  trigger = "header",
}: PitchDeckGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const queryClient = useQueryClient();
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleGenerate = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setProgress(0);
    setProgressStage("Fetching data...");

    const user = auth.getUser();
    if (!user) {
      toast.error("You must be signed in to generate a pitch deck.");
      setIsGenerating(false);
      return;
    }

    try {
      // Fetch fresh data using existing query layer (optimistic where cached)
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

      const { blob, filename, pageCount } = await generatePitchDeckPDF(
        {
          project,
          financials: finData as Financials | null,
          estimate: estData as PersistedRoomEstimate | null,
          photos: photosData as ProjectPhoto[],
          analyses: analysesData as PhotoAnalysisResultRow[],
          floorplanModels: (floorplansData as Array<{ id: string; name: string }>) ?? [],
        },
        {
          onProgress: (stage, pct) => {
            setProgressStage(stage);
            if (pct) setProgress(30 + Math.min(pct, 40));
          },
          includePhotos: true,
          include3D: true,
          includeSensitivity: true,
        },
      );

      setProgress(75);
      setProgressStage("Downloading PDF...");

      // Download immediately
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Pitch deck generated", {
        description: `${filename} (${pageCount} pages) — downloaded.`,
      });

      // Optional: save to Supabase (pitch_decks bucket + pitch_deck_exports)
      setProgressStage("Saving to cloud (optional)...");
      setProgress(85);

      try {
        const { record } = await savePitchDeckToSupabase(
          projectId,
          user.id,
          blob,
          filename,
          pageCount,
        );

        // Invalidate history
        await queryClient.invalidateQueries({
          queryKey: pitchDecksByProjectQueryOptions(projectId).queryKey,
        });

        toast.success("Saved to your project", {
          description: "Pitch deck record added. View history in app settings or reports.",
        });

        logger.info("[pitch-deck] saved to Supabase", { projectId, recordId: record?.id });
      } catch (saveErr) {
        // Non-fatal: PDF already downloaded
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
      resetTimerRef.current = setTimeout(() => {
        setIsGenerating(false);
        setProgress(0);
        setProgressStage("");
      }, 600);
    }
  };

  const buttonLabel = trigger === "header" ? "Generate Investor Pitch Deck" : "Generate Pitch Deck";
  const buttonSize = trigger === "header" ? "default" : "sm";

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        onClick={handleGenerate}
        disabled={isGenerating}
        size={buttonSize as "default" | "sm"}
        variant={trigger === "header" ? "default" : "outline"}
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <FileText className="mr-2 h-4 w-4" />
            {buttonLabel}
          </>
        )}
      </Button>

      {isGenerating && progress > 0 && (
        <div className="w-48">
          <Progress value={progress} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{progressStage}</p>
        </div>
      )}
    </div>
  );
}
