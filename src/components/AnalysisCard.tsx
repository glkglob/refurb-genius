import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { memo } from "react";
import { Sparkles, AlertTriangle, Wrench } from "lucide-react";
import type { RoomAnalysis, ConditionLevel } from "@/core/ai";
import { AnalysisSourceBadge } from "./AnalysisSourceBadge";

const conditionTone: Record<ConditionLevel, Parameters<typeof StatusBadge>[0]["tone"]> = {
  Modern: "success",
  Average: "default",
  Dated: "accent",
  Poor: "destructive",
  "Full Renovation Needed": "destructive",
};

export type AnalysisCardProps = {
  analysis: RoomAnalysis;
};

function AnalysisCardComponent({ analysis: r }: AnalysisCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[16/10] w-full bg-muted">
        <img
          src={r.photo_url}
          alt={r.room_type}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge variant="secondary" className="bg-background/85 backdrop-blur">
            {r.room_type}
          </Badge>
          <StatusBadge tone={conditionTone[r.condition_level]}>{r.condition_level}</StatusBadge>
        </div>
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
          <Badge variant="secondary" className="bg-background/85 backdrop-blur">
            <Sparkles className="mr-1 h-3 w-3 text-accent" />
            {Math.round(r.confidence_score * 100)}%
          </Badge>
          <AnalysisSourceBadge source={r.source} />
        </div>
      </div>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">{r.room_type}</h3>
          <span className="text-xs text-muted-foreground">{r.refurbishment_level} refurb</span>
        </div>

        <p className="text-sm text-foreground">{r.ai_summary}</p>

        <IssueList
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Visible issues"
          items={r.visible_issues}
        />
        <IssueList
          icon={<Wrench className="h-3.5 w-3.5" />}
          label="Recommended works"
          items={r.recommended_works}
        />
      </CardContent>
    </Card>
  );
}

function IssueList({
  icon,
  label,
  items,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </p>
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i} className="text-sm text-foreground">
            • {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const AnalysisCard = memo(AnalysisCardComponent);
