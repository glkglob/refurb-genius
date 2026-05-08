import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/LoadingState";
import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle, Wrench, ArrowRight, Palette, Sofa, Lightbulb, Layers } from "lucide-react";
import { analysisStore, type RoomAnalysis, type ConditionLevel } from "@/lib/analysis";
import { projectStore } from "@/lib/projects";
import { DISCLAIMER } from "@/lib/mockData";
import { REDESIGN_CONCEPTS } from "@/lib/redesign";

export const Route = createFileRoute("/projects/$id/analysis")({
  head: () => ({ meta: [{ title: "AI analysis — Refurb Genius" }] }),
  component: AnalysisPage,
});

const conditionTone: Record<ConditionLevel, string> = {
  "Modern": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "Average": "bg-secondary text-foreground border-border",
  "Dated": "bg-accent/10 text-accent border-accent/20",
  "Poor": "bg-destructive/10 text-destructive border-destructive/20",
  "Full Renovation Needed": "bg-destructive/15 text-destructive border-destructive/30",
};

function AnalysisPage() {
  const { id } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<RoomAnalysis[]>([]);

  useEffect(() => {
    let cancelled = false;
    const cached = analysisStore.get(id);
    if (cached && cached.length) {
      setResults(cached);
      setLoading(false);
      return;
    }
    analysisStore.run(id).then((r) => {
      if (cancelled) return;
      setResults(r);
      setLoading(false);
      projectStore.setStage(id, "analysis", true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <AppLayout title="AI analysis" subtitle="Analysing your photos…">
        <LoadingState label="Running mock AI analysis on your photos" />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="AI analysis"
      subtitle="Room-by-room condition assessment with recommended works."
      actions={
        <Button asChild>
          <Link to="/projects/$id/estimate" params={{ id }}>
            Continue to estimate <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        {results.map((r) => (
          <Card key={r.id} className="overflow-hidden">
            <div className="relative aspect-[16/10] w-full bg-muted">
              <img
                src={r.photo_url}
                alt={r.room_type}
                className="h-full w-full object-cover"
              />
              <div className="absolute left-3 top-3 flex gap-2">
                <Badge variant="secondary" className="bg-background/85 backdrop-blur">
                  {r.room_type}
                </Badge>
                <Badge variant="outline" className={conditionTone[r.condition_level]}>
                  {r.condition_level}
                </Badge>
              </div>
              <div className="absolute right-3 top-3">
                <Badge variant="secondary" className="bg-background/85 backdrop-blur">
                  <Sparkles className="mr-1 h-3 w-3 text-accent" />
                  {Math.round(r.confidence_score * 100)}%
                </Badge>
              </div>
            </div>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">{r.room_type}</h3>
                <span className="text-xs text-muted-foreground">
                  {r.refurbishment_level} refurb
                </span>
              </div>

              <p className="text-sm text-foreground">{r.ai_summary}</p>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" /> Visible issues
                </p>
                <ul className="space-y-1">
                  {r.visible_issues.map((i) => (
                    <li key={i} className="text-sm text-foreground">
                      • {i}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Wrench className="h-3.5 w-3.5" /> Recommended works
                </p>
                <ul className="space-y-1">
                  {r.recommended_works.map((w) => (
                    <li key={w} className="text-sm text-foreground">
                      • {w}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8 border-dashed">
        <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold text-foreground">Ready for cost estimate?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a UK refurbishment cost estimate based on this analysis.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/projects/$id/estimate" params={{ id }}>
              View estimate <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-muted-foreground">{DISCLAIMER}</p>
    </AppLayout>
  );
}
