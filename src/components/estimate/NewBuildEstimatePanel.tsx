/**
 * New-build £/m² estimate UI (from refurb-estimator engines).
 */
import { useMemo, useState } from "react";
import { runNewBuildEstimate, type NewBuildPropertyType, type NewBuildSpec } from "@repo/services";
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

const PROPERTY_TYPES: NewBuildPropertyType[] = [
  "Detached House",
  "Semi-Detached House",
  "Terraced House",
  "Bungalow",
  "Flat / Apartment",
  "Townhouse",
  "Office",
  "Retail",
  "Industrial",
];

const SPECS: NewBuildSpec[] = ["basic", "standard", "premium"];

function mapProjectPropertyType(projectType: string): NewBuildPropertyType {
  const n = projectType.toLowerCase();
  if (n.includes("bungalow")) return "Bungalow";
  if (n.includes("flat") || n.includes("apartment")) return "Flat / Apartment";
  if (n.includes("semi")) return "Semi-Detached House";
  if (n.includes("detached")) return "Detached House";
  if (n.includes("terrace") || n.includes("town")) return "Terraced House";
  return "Terraced House";
}

export type NewBuildEstimatePanelProps = {
  region: UKRegion;
  sizeSqm: number;
  propertyType: string;
  postcode?: string;
  bedrooms?: number;
};

export function NewBuildEstimatePanel({
  region,
  sizeSqm,
  propertyType,
  postcode,
  bedrooms,
}: NewBuildEstimatePanelProps) {
  const [nbType, setNbType] = useState<NewBuildPropertyType>(() =>
    mapProjectPropertyType(propertyType),
  );
  const [spec, setSpec] = useState<NewBuildSpec>("standard");
  const [storeys, setStoreys] = useState("2");
  const [garage, setGarage] = useState(false);
  const [renewables, setRenewables] = useState(false);

  const result = useMemo(() => {
    try {
      return runNewBuildEstimate({
        totalAreaM2: sizeSqm > 0 ? sizeSqm : 100,
        propertyType: nbType,
        spec,
        region,
        postcode: postcode || undefined,
        storeys: Math.max(1, Number(storeys) || 2),
        bedrooms: bedrooms ?? 3,
        includeGarage: garage,
        includeRenewables: renewables,
      });
    } catch {
      return null;
    }
  }, [sizeSqm, nbType, spec, region, postcode, storeys, bedrooms, garage, renewables]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Property type</Label>
            <Select value={nbType} onValueChange={(v) => setNbType(v as NewBuildPropertyType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Build specification</Label>
            <Select value={spec} onValueChange={(v) => setSpec(v as NewBuildSpec)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPECS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Storeys</Label>
            <input
              type="number"
              min={1}
              max={20}
              value={storeys}
              onChange={(e) => setStoreys(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={garage} onCheckedChange={(c) => setGarage(c === true)} />
            Include garage
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={renewables} onCheckedChange={(c) => setRenewables(c === true)} />
            Renewables package
          </label>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  New-build cost estimate
                </p>
                <p className="text-sm text-muted-foreground">
                  {result.region} · Contingency {result.contingencyPercent}% · Professional fees{" "}
                  {result.professionalFeesPercent}%
                </p>
              </div>
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                New build — not refurb ROI authority
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Low" value={formatGBP(result.totalLow)} />
              <Metric label="Typical" value={formatGBP(result.totalTypical)} highlight />
              <Metric label="High" value={formatGBP(result.totalHigh)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Base build (typical)" value={formatGBP(result.baseBuild.typical)} />
              <Metric
                label="Cost per m² (typical)"
                value={formatGBP(Math.round(result.costPerM2.typical))}
              />
            </div>

            {result.extras.length > 0 ? (
              <ul className="space-y-1 border-t pt-4 text-sm">
                {result.extras.map((e) => (
                  <li key={e.label} className="flex justify-between">
                    <span>{e.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatGBP(e.typical)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-destructive">Could not calculate new-build estimate.</p>
      )}

      <p className="text-xs text-muted-foreground">
        Rates adapted from UK new-build £/m² bands (refurb-estimator). For refurbishment projects
        use Quick estimate.
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
