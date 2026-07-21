/**
 * SDLT + acquisition cost strip for Deal Copilot.
 * Uses deterministic engines from @repo/services (ported from refurb-estimator).
 */
import { useMemo } from "react";
import { calculateStampDutyLandTax, calculateDevelopmentAppraisal } from "@repo/services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatCurrency(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  return `${value.toFixed(1)}%`;
}

export type DealAcquisitionCostsProps = {
  purchasePrice: number | null | undefined;
  estimatedGdv?: number | null;
  refurbBudget?: number | null;
  holdingCosts?: number | null;
};

export function DealAcquisitionCosts({
  purchasePrice,
  estimatedGdv,
  refurbBudget,
  holdingCosts,
}: DealAcquisitionCostsProps) {
  const sdlt = useMemo(() => {
    if (!purchasePrice || purchasePrice <= 0) return null;
    return {
      withSurcharge: calculateStampDutyLandTax(purchasePrice, true),
      withoutSurcharge: calculateStampDutyLandTax(purchasePrice, false),
    };
  }, [purchasePrice]);

  const appraisal = useMemo(() => {
    if (!purchasePrice || purchasePrice <= 0) return null;
    if (!estimatedGdv || estimatedGdv <= 0) return null;
    if (refurbBudget == null || refurbBudget < 0) return null;

    return calculateDevelopmentAppraisal({
      purchasePrice,
      grossDevelopmentValue: estimatedGdv,
      acquisitionLegalFees: Math.round(purchasePrice * 0.01),
      buildCosts: refurbBudget,
      professionalFees: Math.round(refurbBudget * 0.08),
      planningCosts: 1500,
      contingencyPercent: 10,
      includeFinance: true,
      bridgingRateMonthlyPercent: 0.75,
      loanTermMonths: 12,
      loanToValuePercent: 70,
      saleLegalFees: 2000,
      estateAgentFeePercent: 1.5,
      targetProfitMarginPercent: 15,
    });
  }, [purchasePrice, estimatedGdv, refurbBudget]);

  if (!sdlt) {
    return null;
  }

  const viabilityTone =
    appraisal?.viability === "viable"
      ? "text-green-700"
      : appraisal?.viability === "marginal"
        ? "text-amber-700"
        : "text-red-700";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Acquisition costs</CardTitle>
        <p className="text-xs text-muted-foreground">
          England residential SDLT (indicative). Developer surcharge assumes additional property.
          Not tax advice.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              SDLT (additional property)
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatCurrency(sdlt.withSurcharge)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              SDLT (main residence rates)
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatCurrency(sdlt.withoutSurcharge)}
            </p>
          </div>
        </div>

        {appraisal ? (
          <div className="space-y-3 border-t pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Development appraisal (illustrative)
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Total costs (incl. SDLT & finance)</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(appraisal.totalCosts)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gross profit</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(appraisal.grossProfit)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Return on cost</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatPercent(appraisal.returnOnCost)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Viability vs 15% target</p>
                <p className={`text-lg font-semibold capitalize ${viabilityTone}`}>
                  {appraisal.viability}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">BRRR equity @ 75% LTV</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(appraisal.brrr.equityReleased)}
                </p>
              </div>
              {holdingCosts != null && holdingCosts > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground">Your holding costs (input)</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatCurrency(holdingCosts)}
                  </p>
                </div>
              ) : null}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Uses engine mid refurb budget when available, 1% purchase legal fees, 8% professional
              fees on build, 10% contingency, 0.75%/mo bridging on 70% LTV for 12 months. Adjust
              inputs for your deal — figures are deterministic helpers, not advice.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Add GDV and a refurb budget to unlock a full development appraisal.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
