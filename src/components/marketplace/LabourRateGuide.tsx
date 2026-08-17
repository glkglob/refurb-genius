/**
 * Labour rate guide for trades job posting and quote flows.
 * Data: @repo/services TRADE_RATES (from refurb-estimator / Checkatrade 2026).
 */
import { useMemo } from "react";
import {
  TRADE_RATES,
  TRADE_RATES_METADATA,
  estimateLabourCost,
  estimateLabourCostForPostcode,
  postcodeToUkRegion,
  tradeIdForJobCategory,
  type TradeRate,
} from "@repo/services";
import type { UKRegion } from "@repo/types";

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export type LabourRateGuideProps = {
  jobCategory?: string;
  postcode?: string;
  region?: UKRegion;
  /** Suggested labour days for the mid band estimate. */
  days?: number;
  compact?: boolean;
};

export function LabourRateGuide({
  jobCategory,
  postcode,
  region,
  days = 5,
  compact = false,
}: LabourRateGuideProps) {
  const tradeId = tradeIdForJobCategory(jobCategory);

  const trade: TradeRate | null = useMemo(() => {
    return TRADE_RATES.find((t) => t.id === tradeId) ?? TRADE_RATES[0] ?? null;
  }, [tradeId]);

  const labour = useMemo(() => {
    if (!trade) return null;
    try {
      if (postcode?.trim()) {
        return estimateLabourCostForPostcode(trade.id, days, postcode.trim());
      }
      return {
        ...estimateLabourCost(trade.id, days, region ?? "West Midlands"),
        region: region ?? ("West Midlands" as UKRegion),
      };
    } catch {
      return null;
    }
  }, [trade, postcode, region, days]);

  const inferredRegion = postcode?.trim()
    ? postcodeToUkRegion(postcode.trim())
    : (region ?? "West Midlands");

  if (!trade || !labour) return null;

  if (compact) {
    return (
      <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{trade.label}</span>
        {" · "}
        {formatGBP(labour.low)}–{formatGBP(labour.high)} labour
        {" · "}
        {inferredRegion}
        {" · "}
        {days}d guide (ex-VAT, materials extra)
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            UK labour rate guide
          </p>
          <h3 className="mt-0.5 text-base font-semibold text-foreground">{trade.label}</h3>
        </div>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {TRADE_RATES_METADATA.lastUpdated}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-[11px] text-muted-foreground">Day rate (national band)</p>
          <p className="mt-1 text-sm font-semibold tabular-nums">
            {formatGBP(trade.dayRateMin)}–{formatGBP(trade.dayRateMax)}
          </p>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-[11px] text-muted-foreground">
            {days}-day labour ({labour.region})
          </p>
          <p className="mt-1 text-sm font-semibold tabular-nums">{formatGBP(labour.mid)} mid</p>
          <p className="text-[11px] text-muted-foreground">
            {formatGBP(labour.low)}–{formatGBP(labour.high)}
          </p>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-[11px] text-muted-foreground">Hourly band</p>
          <p className="mt-1 text-sm font-semibold tabular-nums">
            £{trade.hourlyRateMin}–£{trade.hourlyRateMax}/hr
          </p>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {trade.notes} Source: {trade.source}. {TRADE_RATES_METADATA.notes} Use as a budget guide —
        always get local quotes.
      </p>
    </div>
  );
}
