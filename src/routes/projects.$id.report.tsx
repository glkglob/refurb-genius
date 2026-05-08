import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Building2,
  Printer,
  Download,
  Sparkles,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { RequireAuth } from "@/components/RequireAuth";
import { projectStore, photoStore } from "@/core/projects";
import { analysisStore, type RoomAnalysis } from "@/core/ai";
import { formatGBP } from "@/core/pricing";
import { buildReport } from "@/core/reports";

export const Route = createFileRoute("/projects/$id/report")({
  head: () => ({ meta: [{ title: "Investor report — Refurb Genius" }] }),
  component: ReportPage,
});

function ReportPage() {
  const { id } = Route.useParams();
  const project = projectStore.get(id);
  const [analysis, setAnalysis] = useState<RoomAnalysis[]>(
    () => analysisStore.get(id) ?? [],
  );

  useEffect(() => {
    if (!project) return;
    if (analysis.length === 0) {
      analysisStore.run(id).then(setAnalysis);
    }
    projectStore.setStage(id, "report", true);
  }, [id, project, analysis.length]);

  const photos = photoStore.list(id);

  const report = useMemo(
    () =>
      project
        ? buildReport({ project, photos, analysis })
        : null,
    [project, photos, analysis],
  );

  // Shim legacy local shapes from the structured report so the JSX below
  // stays unchanged. All values originate from the deterministic engines.
  const estimate = report
    ? {
        items: report.sections.cost_breakdown.body.items,
        subtotal: report.sections.cost_breakdown.body.subtotal,
        contingency: report.sections.cost_breakdown.body.contingency,
        vat: report.sections.cost_breakdown.body.vat,
        mid_total: report.sections.cost_breakdown.body.mid_total,
        timeline_weeks: report.sections.timeline.body.weeks,
      }
    : null;

  const metrics = report
    ? {
        refurb_budget: report.sections.cost_breakdown.body.mid_total,
        total_cost: report.sections.investment_metrics.body.total_project_cost,
        estimated_profit: report.sections.investment_metrics.body.estimated_profit,
        roi: report.sections.investment_metrics.body.roi,
        yield_pct: report.sections.investment_metrics.body.gross_yield,
        rental_uplift_annual: report.sections.investment_metrics.body.rental_uplift,
        rental_uplift_monthly: Math.round(
          report.sections.investment_metrics.body.rental_uplift / 12,
        ),
        investment_score: report.sections.investment_metrics.body.investment_score,
        risk_level: report.sections.investment_metrics.body.risk_level,
      }
    : null;

  const concepts = report?.sections.redesign_concepts.body.concepts ?? [];
  const disclaimerText = report?.sections.disclaimer.body.text ?? "";

  if (!project) {
    throw notFound();
  }

  const reportDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <RequireAuth>
      <div className="min-h-screen w-full bg-muted/30">
        {/* Toolbar (hidden on print) */}
        <div className="no-print sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Button asChild variant="ghost" size="sm">
              <Link to="/projects/$id" params={{ id }}>
                <ArrowLeft className="h-4 w-4" /> Back to project
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <Download className="h-4 w-4" /> Export PDF
              </Button>
            </div>
          </div>
        </div>

        <main className="print-area mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
          <article className="space-y-10 rounded-xl bg-card p-6 shadow-sm sm:p-10 print:shadow-none">
            {/* Branding header */}
            <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-primary">
                  <Building2 className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-[0.2em]">
                    Refurb Genius
                  </span>
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Investor report
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">{project.name}</p>
              </div>
              <div className="text-sm text-muted-foreground sm:text-right">
                <div className="flex items-center gap-2 sm:justify-end">
                  <Calendar className="h-4 w-4" />
                  <span>{reportDate}</span>
                </div>
                <p className="mt-1">Reference #{project.id}</p>
              </div>
            </header>

            {/* Project summary */}
            <Section title="Project summary" subtitle="Property overview and key details.">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailGrid
                  rows={[
                    ["Address", project.address],
                    ["Postcode", project.postcode],
                    ["Region", project.region],
                    ["Property type", project.property_type],
                  ]}
                />
                <DetailGrid
                  rows={[
                    ["Bedrooms", String(project.bedrooms)],
                    ["Bathrooms", String(project.bathrooms)],
                    ["Size", `${project.size_sqm} sqm`],
                    ["Purchase price", formatGBP(project.purchase_price)],
                    ["Estimated GDV", formatGBP(project.estimated_gdv)],
                  ]}
                />
              </div>
              {project.notes && (
                <p className="mt-4 rounded-md border border-border bg-muted/30 p-4 text-sm text-foreground">
                  {project.notes}
                </p>
              )}
            </Section>

            {/* Photos */}
            {photos.length > 0 && (
              <Section
                title="Uploaded photos"
                subtitle={`${photos.length} property photo${photos.length === 1 ? "" : "s"}.`}
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.slice(0, 9).map((p) => (
                    <div
                      key={p.id}
                      className="aspect-[4/3] overflow-hidden rounded-md border border-border bg-muted"
                    >
                      <img
                        src={p.url}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* AI analysis */}
            {analysis.length > 0 && (
              <Section
                title="AI analysis summary"
                subtitle="Room-by-room condition and recommended works."
              >
                <div className="space-y-3">
                  {analysis.map((r) => (
                    <div
                      key={r.id}
                      className="grid gap-4 rounded-md border border-border p-4 sm:grid-cols-[140px_1fr]"
                    >
                      <div className="aspect-[4/3] overflow-hidden rounded-md bg-muted">
                        <img
                          src={r.photo_url}
                          alt={r.room_type}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-foreground">
                            {r.room_type}
                          </h3>
                          <Badge variant="outline">{r.condition_level}</Badge>
                          <Badge variant="secondary">
                            {r.refurbishment_level} refurb
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Confidence {Math.round(r.confidence_score * 100)}%
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-foreground">{r.ai_summary}</p>
                        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Visible issues
                            </p>
                            <ul className="mt-1 space-y-1 text-foreground">
                              {r.visible_issues.map((i) => (
                                <li key={i}>• {i}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Recommended works
                            </p>
                            <ul className="mt-1 space-y-1 text-foreground">
                              {r.recommended_works.map((i) => (
                                <li key={i}>• {i}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Redesign concepts */}
            <Section
              title="Redesign concepts"
              subtitle="AI-generated style directions for the refurbishment."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {REDESIGN_CONCEPTS.map((c) => (
                  <div
                    key={c.style}
                    className="overflow-hidden rounded-md border border-border"
                  >
                    <div
                      className="aspect-[4/3]"
                      style={{ background: c.afterGradient }}
                    />
                    <div className="p-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <p className="text-sm font-semibold text-foreground">
                          {c.style}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.tagline}
                      </p>
                      <div className="mt-2 flex gap-1">
                        {c.palette.map((p) => (
                          <span
                            key={p.hex}
                            className="h-4 w-4 rounded-full border border-border"
                            style={{ background: p.hex }}
                            title={p.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Cost breakdown */}
            {estimate && (
              <Section
                title="Cost breakdown"
                subtitle="Itemised refurbishment estimate."
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Labour</TableHead>
                      <TableHead className="text-right">Materials</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {estimate.items.map((i) => (
                      <TableRow key={i.category}>
                        <TableCell className="font-medium">{i.category}</TableCell>
                        <TableCell className="text-right">{formatGBP(i.labour)}</TableCell>
                        <TableCell className="text-right">{formatGBP(i.materials)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatGBP(i.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        Subtotal
                      </TableCell>
                      <TableCell className="text-right">
                        {formatGBP(estimate.subtotal)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        Contingency (10%)
                      </TableCell>
                      <TableCell className="text-right">
                        {formatGBP(estimate.contingency)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        VAT (20%)
                      </TableCell>
                      <TableCell className="text-right">{formatGBP(estimate.vat)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/40">
                      <TableCell colSpan={3} className="font-semibold">
                        Mid total
                      </TableCell>
                      <TableCell className="text-right text-base font-semibold">
                        {formatGBP(estimate.mid_total)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Section>
            )}

            {/* Investor metrics */}
            {metrics && estimate && (
              <Section
                title="Investor metrics"
                subtitle="Profitability and risk indicators."
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Refurb budget" value={formatGBP(metrics.refurb_budget)} />
                  <Stat label="Total project cost" value={formatGBP(metrics.total_cost)} />
                  <Stat label="Estimated GDV" value={formatGBP(project.estimated_gdv)} />
                  <Stat
                    label="Estimated profit"
                    value={formatGBP(metrics.estimated_profit)}
                    highlight={metrics.estimated_profit > 0}
                  />
                  <Stat label="ROI" value={`${metrics.roi}%`} />
                  <Stat label="Gross yield" value={`${metrics.yield_pct}%`} />
                  <Stat
                    label="Investment score"
                    value={`${metrics.investment_score} / 10`}
                  />
                  <Stat label="Risk level" value={metrics.risk_level} />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Rental uplift estimated at{" "}
                  <span className="font-medium text-foreground">
                    {formatGBP(metrics.rental_uplift_monthly)}
                  </span>{" "}
                  per month ({formatGBP(metrics.rental_uplift_annual)} per year).
                </p>
              </Section>
            )}

            {/* Timeline */}
            {estimate && (
              <Section
                title="Timeline"
                subtitle="Indicative build programme assuming parallelised trades."
              >
                <div className="rounded-md border border-border p-5">
                  <p className="text-3xl font-semibold tracking-tight text-foreground">
                    {estimate.timeline_weeks} weeks
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Approx. {Math.ceil(estimate.timeline_weeks / 4.33)} months on site,
                    excluding planning and procurement lead times.
                  </p>
                </div>
              </Section>
            )}

            {/* Assumptions */}
            <Section title="Assumptions" subtitle="Key inputs used in this report.">
              <ul className="space-y-2 text-sm text-foreground">
                <li>• Region: {project.region} (regional cost multiplier applied).</li>
                <li>• Condition baseline: Dated. Finish quality: Standard.</li>
                <li>• Contingency 10%, VAT 20% applied to subtotal.</li>
                <li>
                  • Rental uplift derived from property size, bedrooms and finish.
                </li>
                <li>
                  • Investment score weighted 70% ROI / 30% gross yield (capped 1–10).
                </li>
                <li>• Photos and AI analysis based on user-uploaded imagery.</li>
              </ul>
            </Section>

            {/* Disclaimer */}
            <footer className="border-t border-border pt-6">
              <div className="flex items-start gap-3 rounded-md bg-muted/40 p-4">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {DISCLAIMER}
                </p>
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Generated by Refurb Genius · refurbgenius.com
              </p>
            </footer>
          </article>
        </main>
      </div>
    </RequireAuth>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="break-inside-avoid">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function DetailGrid({ rows }: { rows: [string, string][] }) {
  return (
    <div className="divide-y divide-border rounded-md border border-border">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">{k}</span>
          <span className="text-right font-medium text-foreground">{v}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-accent/40 bg-accent/5" : undefined}>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
