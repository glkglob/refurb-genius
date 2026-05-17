import type { RoiEngineResult } from "@repo/services";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCurrency,
  formatPercent,
  formatInvestmentScore,
} from "@/lib/deal-copilot/dealFormatting";

export interface MetricItemProps {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "positive" | "warning" | "critical";
}

function MetricItem({ label, value, hint, icon, tone = "default" }: MetricItemProps) {
  const toneClasses = {
    default: "bg-slate-50",
    positive: "bg-green-50",
    warning: "bg-yellow-50",
    critical: "bg-red-50",
  };

  const valueClasses = {
    default: "text-slate-900",
    positive: "text-green-700",
    warning: "text-yellow-700",
    critical: "text-red-700",
  };

  return (
    <div className={`rounded-lg p-4 ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className={`mt-2 text-2xl font-semibold ${valueClasses[tone]}`}>{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center">{icon}</div>
        )}
      </div>
    </div>
  );
}

export interface DealMetricsGridProps {
  roi: RoiEngineResult | null | undefined;
  projectCost?: number;
}

export function DealMetricsGrid({ roi }: DealMetricsGridProps) {
  if (!roi) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Investment Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Complete the deal details to see metrics.</p>
        </CardContent>
      </Card>
    );
  }

  // Determine tone for each metric based on thresholds
  const getRoiTone = (roiValue: number): "positive" | "warning" | "critical" => {
    if (roiValue >= 20) return "positive";
    if (roiValue >= 10) return "warning";
    return "critical";
  };

  const getYieldTone = (yieldValue: number): "positive" | "warning" | "critical" => {
    if (yieldValue >= 7) return "positive";
    if (yieldValue >= 4) return "warning";
    return "critical";
  };

  const getProfitTone = (profitValue: number): "positive" | "warning" | "critical" => {
    if (profitValue > 0) return profitValue > 100000 ? "positive" : "warning";
    return "critical";
  };

  const getScoreTone = (scoreValue: number): "positive" | "warning" | "critical" => {
    if (scoreValue >= 8) return "positive";
    if (scoreValue >= 5) return "warning";
    return "critical";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Investment Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricItem
            label="ROI"
            value={formatPercent(roi.roi)}
            hint="Return on cost"
            tone={getRoiTone(roi.roi)}
          />
          <MetricItem
            label="Yield"
            value={formatPercent(roi.gross_yield)}
            hint="Gross annual yield"
            tone={getYieldTone(roi.gross_yield)}
          />
          <MetricItem
            label="Profit"
            value={formatCurrency(roi.estimated_profit)}
            hint="Expected gain"
            tone={getProfitTone(roi.estimated_profit)}
          />
          <MetricItem
            label="Score"
            value={formatInvestmentScore(roi.investment_score)}
            hint="Investment quality (1-10)"
            tone={getScoreTone(roi.investment_score)}
          />
        </div>

        {/* Project costs summary */}
        <div className="mt-6 space-y-3 border-t pt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Total Project Cost</p>
              <p className="text-lg font-semibold">{formatCurrency(roi.total_project_cost)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Annual Rental Uplift</p>
              <p className="text-lg font-semibold">{formatCurrency(roi.rental_uplift)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
