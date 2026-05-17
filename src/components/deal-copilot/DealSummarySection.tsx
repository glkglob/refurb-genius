import type { DealAnalysisResult } from "@/types/deal-copilot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCurrency,
  formatPercent,
  formatRecommendation,
} from "@/lib/deal-copilot/dealFormatting";

export interface DealSummarySectionProps {
  analysis: DealAnalysisResult;
  title?: string;
}

export function DealSummarySection({ analysis, title }: DealSummarySectionProps) {
  if (!analysis.ready || !analysis.roi) {
    return null;
  }

  const { label: recommendationLabel } = formatRecommendation(analysis.score.recommendation);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title || "Investment Summary"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="prose prose-sm max-w-none text-foreground">
          <p>
            This property presents a{" "}
            <strong className="text-blue-600">{recommendationLabel.toLowerCase()}</strong>{" "}
            investment opportunity based on financial analysis of the acquisition and refurbishment
            costs.
          </p>

          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">Key Metrics</p>
              <div className="mt-2 grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Projected ROI:</span>
                  <span className="font-semibold text-slate-900">
                    {formatPercent(analysis.roi.roi)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Expected Profit:</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(analysis.roi.estimated_profit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Annual Yield:</span>
                  <span className="font-semibold text-slate-900">
                    {formatPercent(analysis.roi.gross_yield)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Investment Score:</span>
                  <span className="font-semibold text-slate-900">
                    {analysis.roi.investment_score.toFixed(1)}/10
                  </span>
                </div>
              </div>
            </div>

            {analysis.pricing && (
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xs font-medium text-blue-700">Refurbishment Cost</p>
                <div className="mt-2 space-y-1 text-sm">
                  <p className="text-blue-600">
                    Estimated total:{" "}
                    <span className="font-semibold">
                      {formatCurrency(analysis.pricing.mid_total)}
                    </span>
                  </p>
                  <p className="text-xs text-blue-600">
                    Range: {formatCurrency(analysis.pricing.low_total)} —{" "}
                    {formatCurrency(analysis.pricing.high_total)}
                  </p>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-600">
              This analysis is based on deterministic calculations using current market data and
              property condition assessments. Actual results may vary based on execution, market
              conditions, and unforeseen circumstances.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
