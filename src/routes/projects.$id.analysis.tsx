import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/LoadingState";
import { mockAnalysis } from "@/lib/mockData";
import { useEffect, useState } from "react";
import { Sparkles, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/projects/$id/analysis")({
  head: () => ({ meta: [{ title: "AI analysis — Refurb Genius" }] }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const { id } = Route.useParams();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1400);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <AppLayout title="AI analysis" subtitle="Analysing your photos…">
        <LoadingState label="Running mock AI analysis on your photos" />
      </AppLayout>
    );
  }

  const tones: Record<string, string> = {
    High: "bg-destructive/10 text-destructive",
    Medium: "bg-accent/10 text-accent",
    Low: "bg-secondary text-muted-foreground",
  };

  return (
    <AppLayout
      title="AI analysis"
      subtitle="Room-by-room condition assessment and redesign recommendations."
      actions={
        <Button asChild>
          <Link to="/projects/$id/estimate" params={{ id }}>View estimate</Link>
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {mockAnalysis.rooms.map((r) => (
          <Card key={r.name}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">{r.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Condition: {r.condition}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[r.priority]}`}>
                  {r.priority}
                </span>
              </div>
              <p className="mt-3 text-sm text-foreground">{r.notes}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardContent className="p-6">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-accent" /> Redesign recommendations
          </h3>
          <ul className="mt-4 space-y-2">
            {mockAnalysis.recommendations.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {r}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
