import { Badge } from "@/components/ui/badge";
import { FlaskConical, AlertCircle } from "lucide-react";
import type { AnalysisSource } from "@/features/ai-upload";

/**
 * Renders a source badge for RoomAnalysis results.
 * Only "mock" and "fallback" produce visible badges (matching the previous
 * inline logic in AnalysisCard.tsx). "ai" and "persisted" render nothing.
 *
 * This component centralizes the exact styling so it can be reused on the
 * Analysis page (via AnalysisCard) and the Report page.
 */
export function AnalysisSourceBadge({ source }: { source: AnalysisSource }) {
  if (source === "mock") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/40 bg-amber-50/90 text-amber-700 backdrop-blur dark:bg-amber-950/80 dark:text-amber-400"
      >
        <FlaskConical className="mr-1 h-3 w-3" />
        Mock
      </Badge>
    );
  }

  if (source === "fallback") {
    return (
      <Badge
        variant="outline"
        className="border-destructive/40 bg-destructive/10 text-destructive backdrop-blur"
      >
        <AlertCircle className="mr-1 h-3 w-3" />
        Fallback
      </Badge>
    );
  }

  return null;
}
