import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { mockMetrics, mockEstimate, mockAnalysis } from "@/lib/mockData";
import { PoundSterling, TrendingUp, Percent, Home, Download } from "lucide-react";

export const Route = createFileRoute("/projects/$id/report")({
  head: () => ({ meta: [{ title: "Investor report — Refurb Genius" }] }),
  component: ReportPage,
});

function ReportPage() {
  return (
    <AppLayout
      title="Investor report"
      subtitle="Mock financials and refurb summary for this project."
      actions={
        <Button>
          <Download className="h-4 w-4" /> Export PDF
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Purchase price" value={`£${mockMetrics.purchasePrice.toLocaleString()}`} icon={Home} />
        <MetricCard label="Refurb cost" value={`£${mockMetrics.refurbCost.toLocaleString()}`} icon={PoundSterling} />
        <MetricCard label="GDV" value={`£${mockMetrics.gdv.toLocaleString()}`} icon={TrendingUp} tone="accent" />
        <MetricCard label="ROI" value={`${mockMetrics.roi}%`} icon={Percent} tone="accent" />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-base font-semibold text-foreground">Yield & rent</h3>
            <div className="mt-4 space-y-3 text-sm">
              <Row label="Gross yield" value={`${mockMetrics.yieldPct}%`} />
              <Row label="Monthly rent" value={`£${mockMetrics.monthlyRent.toLocaleString()}`} />
              <Row label="Annual rent" value={`£${(mockMetrics.monthlyRent * 12).toLocaleString()}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="text-base font-semibold text-foreground">Scope summary</h3>
            <ul className="mt-4 space-y-2 text-sm text-foreground">
              {mockAnalysis.recommendations.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardContent className="p-6">
          <h3 className="text-base font-semibold text-foreground">Cost breakdown</h3>
          <div className="mt-4 divide-y divide-border">
            {mockEstimate.breakdown.map((b) => (
              <Row key={b.category} label={b.category} value={`£${b.cost.toLocaleString()}`} />
            ))}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
