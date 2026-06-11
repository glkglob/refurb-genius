import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2, AlertCircle, Copy, Check, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { analyzeDealServerFn } from "@/serverFns/dealAnalysis";
import type { DealAnalysis, DealRiskSeverity } from "@/core/dealCopilot/dealAnalysis";
import { trackEvent } from "@/lib/analytics";

const SEVERITY_STYLES: Record<DealRiskSeverity, string> = {
  high: "border-destructive/40 bg-destructive/10 text-destructive",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "border-border bg-secondary/40 text-muted-foreground",
};

function formatGbp(n: number): string {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function analysisToText(a: DealAnalysis): string {
  const lines = ["Valuation summary", a.valuationSummary, ""];
  if (a.aiOpinion) {
    const o = a.aiOpinion;
    lines.push("AI opinion (not authoritative)");
    if (typeof o.estimatedValue === "number")
      lines.push(`- Est. market value: ${formatGbp(o.estimatedValue)}`);
    if (typeof o.refurbCost === "number") lines.push(`- Refurb cost: ${formatGbp(o.refurbCost)}`);
    if (typeof o.projectedRoiPercent === "number")
      lines.push(`- Projected ROI: ${o.projectedRoiPercent}%`);
    if (o.rationale) lines.push(`  ${o.rationale}`);
    lines.push("");
  }
  if (a.riskFlags.length > 0) {
    lines.push("Risk flags");
    for (const r of a.riskFlags) {
      lines.push(`- [${r.severity.toUpperCase()}] ${r.description}`);
      if (r.mitigation) lines.push(`  Mitigation: ${r.mitigation}`);
    }
    lines.push("");
  }
  if (a.nextSteps.length > 0) {
    lines.push("Next steps");
    for (const s of a.nextSteps) lines.push(`- ${s}`);
  }
  return lines.join("\n");
}

export function DealAnalysisCard({ opportunityId }: { opportunityId: string }) {
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () => analyzeDealServerFn({ data: { opportunityId } }),
    onSuccess: () => trackEvent("deal_analyzed"),
  });

  const analysis = mutation.data;

  const handleCopy = async () => {
    if (!analysis) return;
    try {
      await navigator.clipboard.writeText(analysisToText(analysis));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context); silently no-op.
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-accent" />
              AI deal analysis
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Qualitative underwriting read. Valuation and ROI figures stay with the deterministic
              engine above.
            </p>
          </div>
          <div className="flex gap-2">
            {analysis ? (
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy to report"}
              </Button>
            ) : null}
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {mutation.isPending ? "Analysing…" : analysis ? "Re-run analysis" : "Run AI analysis"}
            </Button>
          </div>
        </div>

        {mutation.isError && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {mutation.error instanceof Error ? mutation.error.message : "Analysis failed."}
            </span>
          </div>
        )}

        {analysis ? (
          <div className="mt-5 space-y-5">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Valuation summary
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground">{analysis.valuationSummary}</p>
            </section>

            {analysis.aiOpinion &&
              (typeof analysis.aiOpinion.estimatedValue === "number" ||
                typeof analysis.aiOpinion.refurbCost === "number" ||
                typeof analysis.aiOpinion.projectedRoiPercent === "number") && (
                <section className="rounded-xl border border-dashed border-border bg-secondary/20 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    AI opinion · not authoritative
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The model's independent estimate. Your figures above remain the source of truth.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {typeof analysis.aiOpinion.estimatedValue === "number" && (
                      <OpinionStat
                        label="Est. market value"
                        value={formatGbp(analysis.aiOpinion.estimatedValue)}
                      />
                    )}
                    {typeof analysis.aiOpinion.refurbCost === "number" && (
                      <OpinionStat
                        label="Refurb cost"
                        value={formatGbp(analysis.aiOpinion.refurbCost)}
                      />
                    )}
                    {typeof analysis.aiOpinion.projectedRoiPercent === "number" && (
                      <OpinionStat
                        label="Projected ROI"
                        value={`${analysis.aiOpinion.projectedRoiPercent}%`}
                      />
                    )}
                  </div>
                  {analysis.aiOpinion.rationale ? (
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      {analysis.aiOpinion.rationale}
                    </p>
                  ) : null}
                </section>
              )}

            {analysis.riskFlags.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Risk flags
                </h3>
                <ul className="mt-2 space-y-2">
                  {analysis.riskFlags.map((risk) => (
                    <li
                      key={`${risk.severity}-${risk.description}`}
                      className={`rounded-xl border p-3 text-sm ${SEVERITY_STYLES[risk.severity]}`}
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide">
                        {risk.severity}
                      </span>
                      <p className="mt-1 leading-6 text-foreground">{risk.description}</p>
                      {risk.mitigation ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Mitigation: {risk.mitigation}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {analysis.nextSteps.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5" />
                  Next steps
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {analysis.nextSteps.map((step) => (
                    <li key={step} className="flex gap-2 text-sm leading-6 text-foreground">
                      <span className="text-accent">•</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : (
          !mutation.isPending && (
            <p className="mt-5 rounded-xl border border-border bg-secondary/30 p-4 text-sm leading-6 text-muted-foreground">
              Run an AI analysis to get a qualitative underwriting read — narrative summary, risk
              flags, and suggested next steps — grounded in the figures above.
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}

function OpinionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
