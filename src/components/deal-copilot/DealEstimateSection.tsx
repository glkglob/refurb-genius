import type { PricingEngineResult } from "@repo/services";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatWeeks } from "@/lib/deal-copilot/dealFormatting";

export interface DealEstimateSectionProps {
  pricing: PricingEngineResult | null | undefined;
}

export function DealEstimateSection({ pricing }: DealEstimateSectionProps) {
  if (!pricing) {
    return null;
  }

  const {
    lineItems,
    labour_total,
    materials_total,
    subtotal,
    contingency,
    vat,
    mid_total,
    timeline_weeks,
  } = pricing;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Refurbishment Estimate</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Category breakdown */}
        {lineItems.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-foreground">Cost by category</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Category
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Labour
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Materials
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Total
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Timeline
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.category} className="border-b">
                      <td className="px-3 py-2">{item.category}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.labour)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.materials)}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatCurrency(item.total)}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {formatWeeks(item.weeks)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Totals summary */}
        <div className="space-y-3 border-t pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Labour</p>
              <p className="text-lg font-semibold">{formatCurrency(labour_total)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Materials</p>
              <p className="text-lg font-semibold">{formatCurrency(materials_total)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Subtotal</p>
              <p className="text-lg font-semibold">{formatCurrency(subtotal)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Contingency (10%)</p>
              <p className="text-lg font-semibold">{formatCurrency(contingency)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">VAT (20%)</p>
              <p className="text-lg font-semibold">{formatCurrency(vat)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Total Estimate</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(mid_total)}</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-xs font-medium text-blue-900">Expected timeline</p>
            <p className="text-lg font-semibold text-blue-900">{formatWeeks(timeline_weeks)}</p>
          </div>
        </div>

        {/* Range summary */}
        <div className="space-y-2 border-t pt-4">
          <p className="text-xs font-medium text-muted-foreground">Contingency range</p>
          <div className="text-sm text-muted-foreground">
            <p>
              Low estimate:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(pricing.low_total)}
              </span>
            </p>
            <p>
              High estimate:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(pricing.high_total)}
              </span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
