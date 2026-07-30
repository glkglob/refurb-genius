/**
 * CostSummary — reusable estimate summary presentation.
 *
 * Displays mid, range, confidence, source, drivers and assumptions.
 * Never computes money. All figures arrive via props from an engine result.
 *
 * Initial owner: features/estimate/presentation.
 * Promote to @repo/ui only after a second real consumer exists.
 */
import { Badge, Card, cn } from "@repo/ui";
import type { EstimateSource } from "../../domain";

export type CostSummaryConfidence = "low" | "medium" | "high";

export type CostSummaryProps = {
  mid: number;
  low: number;
  high: number;
  labour?: number;
  materials?: number;
  contingency?: number;
  vat?: number;
  confidence: CostSummaryConfidence;
  source: EstimateSource;
  drivers?: Array<{ label: string; value: string }>;
  assumptions?: string[];
  warnings?: string[];
  className?: string;
  /** Optional heading override (default: "Estimated cost"). */
  title?: string;
};

const SOURCE_LABEL: Record<EstimateSource, string> = {
  engine: "Engine rates",
  "ai-assisted": "AI-assisted · rates from pricing engine",
  fallback: "Fallback estimate",
  mock: "Mock (dev only)",
};

const CONFIDENCE_VARIANT: Record<
  CostSummaryConfidence,
  "default" | "secondary" | "outline" | "destructive"
> = {
  low: "outline",
  medium: "secondary",
  high: "default",
};

function formatGbp(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function CostSummary({
  mid,
  low,
  high,
  labour,
  materials,
  contingency,
  vat,
  confidence,
  source,
  drivers,
  assumptions,
  warnings,
  className,
  title = "Estimated cost",
}: CostSummaryProps) {
  return (
    <Card className={cn("p-6 space-y-4", className)}>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-semibold tracking-tight tabular-nums">
          {formatGbp(mid)}
          <span className="ml-2 text-base font-normal text-muted-foreground">mid</span>
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">
          Likely range {formatGbp(low)} – {formatGbp(high)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={CONFIDENCE_VARIANT[confidence]}>Confidence: {confidence}</Badge>
        <Badge variant="outline">{SOURCE_LABEL[source]}</Badge>
      </div>

      {(labour != null || materials != null) && (
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {labour != null && (
            <div>
              <p className="text-muted-foreground">Labour</p>
              <p className="font-medium tabular-nums">{formatGbp(labour)}</p>
            </div>
          )}
          {materials != null && (
            <div>
              <p className="text-muted-foreground">Materials</p>
              <p className="font-medium tabular-nums">{formatGbp(materials)}</p>
            </div>
          )}
          {contingency != null && (
            <div>
              <p className="text-muted-foreground">Contingency</p>
              <p className="font-medium tabular-nums">{formatGbp(contingency)}</p>
            </div>
          )}
          {vat != null && (
            <div>
              <p className="text-muted-foreground">VAT</p>
              <p className="font-medium tabular-nums">{formatGbp(vat)}</p>
            </div>
          )}
        </div>
      )}

      {drivers && drivers.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">What drives this cost</p>
          <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            {drivers.map((d) => (
              <li key={d.label}>
                <span className="font-medium text-foreground">{d.label}:</span> {d.value}
              </li>
            ))}
          </ul>
        </div>
      )}

      {assumptions && assumptions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Assumptions</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Warnings</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-400">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Estimate from Refurb Genius — not a fixed price or formal quotation.
      </p>
    </Card>
  );
}
