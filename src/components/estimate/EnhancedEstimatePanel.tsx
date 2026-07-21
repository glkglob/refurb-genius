/**
 * Scope-based enhanced estimate UI (from refurb-estimator engines).
 * Advisory alongside the canonical category pricing engine.
 */
import { useMemo, useState } from "react";
import {
  runEnhancedEstimate,
  inferPropertyCategory,
  type AdditionalFeature,
  type QualityTier,
  type RenovationScope,
} from "@repo/services";
import type { UKRegion } from "@repo/types";
import {
  Card,
  CardContent,
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

const SCOPES: RenovationScope[] = ["cosmetic", "standard", "full", "structural"];
const QUALITY: QualityTier[] = ["budget", "standard", "premium"];

const FEATURES: { id: AdditionalFeature; label: string }[] = [
  { id: "loft_conversion", label: "Loft conversion" },
  { id: "extension_single_storey", label: "Single-storey extension" },
  { id: "extension_double_storey", label: "Double-storey extension" },
  { id: "basement_conversion", label: "Basement conversion" },
  { id: "new_roof", label: "New roof" },
  { id: "full_rewire", label: "Full rewire" },
  { id: "new_boiler", label: "New boiler & heating" },
  { id: "underfloor_heating", label: "Underfloor heating" },
  { id: "solar_panels", label: "Solar panels" },
  { id: "new_windows_throughout", label: "New windows throughout" },
  { id: "garden_landscaping", label: "Garden landscaping" },
  { id: "driveway", label: "New driveway" },
];

export type EnhancedEstimatePanelProps = {
  region: UKRegion;
  sizeSqm: number;
  propertyType: string;
  postcode?: string;
};

export function EnhancedEstimatePanel({
  region,
  sizeSqm,
  propertyType,
  postcode,
}: EnhancedEstimatePanelProps) {
  const [scope, setScope] = useState<RenovationScope>("standard");
  const [quality, setQuality] = useState<QualityTier>("standard");
  const [listed, setListed] = useState(false);
  const [yearBuilt, setYearBuilt] = useState<string>("");
  const [features, setFeatures] = useState<AdditionalFeature[]>([]);

  const result = useMemo(() => {
    try {
      return runEnhancedEstimate({
        totalAreaM2: sizeSqm > 0 ? sizeSqm : 90,
        region,
        renovationScope: scope,
        qualityTier: quality,
        propertyCategory: inferPropertyCategory(propertyType),
        postcode: postcode || undefined,
        yearBuilt: yearBuilt ? Number(yearBuilt) : undefined,
        listedBuilding: listed,
        additionalFeatures: features,
      });
    } catch {
      return null;
    }
  }, [sizeSqm, region, scope, quality, propertyType, postcode, yearBuilt, listed, features]);

  function toggleFeature(id: AdditionalFeature, checked: boolean) {
    setFeatures((prev) => (checked ? [...prev, id] : prev.filter((f) => f !== id)));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Renovation scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as RenovationScope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quality tier</Label>
            <Select value={quality} onValueChange={(v) => setQuality(v as QualityTier)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUALITY.map((q) => (
                  <SelectItem key={q} value={q} className="capitalize">
                    {q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Year built (optional)</Label>
            <input
              type="number"
              min={1800}
              max={new Date().getFullYear()}
              value={yearBuilt}
              onChange={(e) => setYearBuilt(e.target.value)}
              placeholder="e.g. 1965"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-3">
            <Checkbox checked={listed} onCheckedChange={(c) => setListed(c === true)} />
            Listed building (+25% surcharge)
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <Label className="mb-3 block">Additional features</Label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <label key={f.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={features.includes(f.id)}
                  onCheckedChange={(c) => toggleFeature(f.id, c === true)}
                />
                {f.label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Enhanced scope estimate
                </p>
                <p className="text-sm text-muted-foreground">
                  Region: {result.region} · Contingency {result.contingencyPercent}% · Fees{" "}
                  {result.feesPercent}%
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Advisory — not Deal Copilot authority
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Low" value={formatGBP(result.totalLow)} />
              <Metric label="Typical" value={formatGBP(result.totalTypical)} highlight />
              <Metric label="High" value={formatGBP(result.totalHigh)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                label="Base renovation (typical)"
                value={formatGBP(result.baseRenovation.typical)}
              />
              <Metric
                label="Cost per m² (typical)"
                value={formatGBP(Math.round(result.costPerM2.typical))}
              />
            </div>

            {result.additionalFeatureCosts.length > 0 ? (
              <div className="space-y-2 border-t pt-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Features</p>
                <ul className="space-y-1 text-sm">
                  {result.additionalFeatureCosts.map((f) => (
                    <li key={f.feature} className="flex justify-between gap-4">
                      <span>{f.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatGBP(f.typical)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.adjustments.length > 0 ? (
              <div className="space-y-1 border-t pt-4 text-xs text-muted-foreground">
                {result.adjustments.map((a) => (
                  <p key={a.label}>
                    {a.label}: {formatGBP(a.amount)} — {a.reason}
                  </p>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-destructive">Could not calculate enhanced estimate.</p>
      )}

      <p className="text-xs text-muted-foreground">
        Uses £/m² scope rates from the imported cost library. For investor ROI use the{" "}
        <strong>Quick estimate</strong> tab (category pricing engine).
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-3 ${highlight ? "bg-accent/10 ring-1 ring-accent/30" : "bg-slate-50"}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
