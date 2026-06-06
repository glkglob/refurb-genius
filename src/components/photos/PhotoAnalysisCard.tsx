"use client";

import { Card, CardContent, CardHeader } from "@repo/ui";
import { Badge } from "@repo/ui";
import { Button } from "@repo/ui";
import { Checkbox } from "@repo/ui";
import { AlertTriangle, CheckCircle, Sparkles, Edit2 } from "lucide-react";
import type { ProjectPhoto } from "@/lib/photos";
import type { PhotoAnalysisResultRow } from "@/lib/queries/photo-analysis";

interface ParsedDefect {
  description: string;
  severity: "low" | "medium" | "high";
  category?: string;
  estimated_cost?: number;
}

interface ParsedAnalysis {
  room?: string;
  condition_report?: string;
  defects?: ParsedDefect[];
  material_estimates?: Array<{
    name: string;
    quantity: number;
    unit: string;
    cost_per_unit?: number;
  }>;
  cost_suggestions?: { low: number; mid: number; high: number };
  category?: string;
  confidence?: number;
}

interface PhotoAnalysisCardProps {
  photo: ProjectPhoto;
  analysis?: PhotoAnalysisResultRow;
  isSelected?: boolean;
  onToggleSelect?: (photoId: string, analysisId?: string) => void;
  onViewDetails: (photo: ProjectPhoto, analysis?: PhotoAnalysisResultRow) => void;
  onEdit?: (photo: ProjectPhoto, analysis: PhotoAnalysisResultRow) => void;
  onApply?: (photo: ProjectPhoto, analysis: PhotoAnalysisResultRow) => void;
}

function getSeverityColor(sev: string) {
  if (sev === "high") return "destructive";
  if (sev === "medium") return "default";
  return "secondary";
}

export function PhotoAnalysisCard({
  photo,
  analysis,
  isSelected,
  onToggleSelect,
  onViewDetails,
  onEdit,
  onApply,
}: PhotoAnalysisCardProps) {
  const hasAnalysis = !!analysis;
  const parsed: ParsedAnalysis = (analysis?.analysis_data as ParsedAnalysis) || {};
  const defects = parsed.defects || [];
  const maxSeverity = defects.length
    ? defects.reduce(
        (max, d) => {
          const order = { high: 3, medium: 2, low: 1 };
          return order[d.severity] > order[max] ? d.severity : max;
        },
        "low" as "low" | "medium" | "high",
      )
    : null;

  const confidence = analysis?.confidence ?? parsed.confidence ?? 0;

  return (
    <Card
      className={`group overflow-hidden transition-all ${isSelected ? "ring-2 ring-primary" : "hover:shadow-md"}`}
    >
      <div className="relative aspect-video bg-muted overflow-hidden">
        <img
          src={photo.url}
          alt={photo.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          loading="lazy"
        />
        <div className="absolute top-2 left-2 flex gap-1">
          {hasAnalysis ? (
            <Badge variant="default" className="bg-green-600">
              <Sparkles className="h-3 w-3 mr-1" /> Analyzed
            </Badge>
          ) : (
            <Badge variant="outline">Unanalyzed</Badge>
          )}
          {parsed.room && <Badge variant="secondary">{parsed.room}</Badge>}
        </div>
        {maxSeverity && (
          <div className="absolute top-2 right-2">
            <Badge
              variant={
                getSeverityColor(maxSeverity) as "default" | "destructive" | "secondary" | "outline"
              }
              className="capitalize"
            >
              {maxSeverity} severity
            </Badge>
          </div>
        )}
        {onToggleSelect && hasAnalysis && (
          <div className="absolute bottom-2 right-2">
            <Checkbox
              checked={!!isSelected}
              onCheckedChange={() => onToggleSelect(photo.id, analysis?.id)}
              aria-label="Select for apply"
            />
          </div>
        )}
      </div>

      <CardHeader className="pb-2 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="truncate text-sm font-medium">{photo.name}</div>
          {hasAnalysis && confidence > 0 && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              {Math.round(confidence * 100)}%
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-3 text-xs space-y-2">
        {hasAnalysis ? (
          <>
            {parsed.condition_report && (
              <p className="line-clamp-2 text-muted-foreground">{parsed.condition_report}</p>
            )}
            {defects.length > 0 && (
              <div>
                <div className="font-medium mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {defects.length} defects
                </div>
                <ul className="space-y-0.5 pl-1 text-muted-foreground">
                  {defects.slice(0, 2).map((d, i) => (
                    <li key={`${d.description}-${i}`} className="truncate">
                      • {d.description} ({d.severity})
                    </li>
                  ))}
                  {defects.length > 2 && <li>+{defects.length - 2} more</li>}
                </ul>
              </div>
            )}
            {parsed.cost_suggestions && (
              <div className="text-muted-foreground">Est. £{parsed.cost_suggestions.mid} (mid)</div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            No AI analysis yet. Upload triggered analysis may be processing.
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-xs"
            onClick={() => onViewDetails(photo, analysis)}
          >
            View Details
          </Button>
          {hasAnalysis && onEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => onEdit(photo, analysis)}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
          {hasAnalysis && onApply && (
            <Button
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => onApply(photo, analysis)}
            >
              <CheckCircle className="h-3 w-3 mr-1" /> Apply
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
