"use client";

import { Button } from "@repo/ui";
import { Progress } from "@repo/ui";
import { FileText, Loader2 } from "lucide-react";
import { useGenerateAndSavePitchDeck } from "@/features/export";
import type { ProjectWithProgress } from "@/lib/mappers";

interface PitchDeckGeneratorProps {
  projectId: string;
  project?: ProjectWithProgress;
  trigger?: "header" | "financials";
}

export function PitchDeckGenerator({
  projectId,
  project,
  trigger = "header",
}: PitchDeckGeneratorProps) {
  const { generatePitchDeck, isPending, progress, progressStage } = useGenerateAndSavePitchDeck({
    projectId,
    project,
  });

  const buttonLabel = trigger === "header" ? "Generate Investor Pitch Deck" : "Generate Pitch Deck";
  const buttonSize = trigger === "header" ? "default" : "sm";

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        onClick={() => void generatePitchDeck()}
        disabled={isPending}
        size={buttonSize as "default" | "sm"}
        variant={trigger === "header" ? "default" : "outline"}
      >
        {isPending ? (
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

      {isPending && progress > 0 && (
        <div className="w-48">
          <Progress value={progress} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{progressStage}</p>
        </div>
      )}
    </div>
  );
}
