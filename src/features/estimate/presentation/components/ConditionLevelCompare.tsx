/**
 * Advisory ConditionLevel comparison table for Quick estimate.
 *
 * Display-only. Does not change the selected condition, save, or compute
 * money — every figure arrives from compareConditionLevels / runPricingEngine.
 */
import { Badge, Card, CardContent } from "@repo/ui";
import type { ConditionLevel } from "@repo/types";
import type { ConditionLevelCompareRow } from "../../application";

export type ConditionLevelCompareProps = {
  rows: ConditionLevelCompareRow[];
  selectedCondition: ConditionLevel;
};

function formatGbp(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function ConditionLevelCompare({ rows, selectedCondition }: ConditionLevelCompareProps) {
  return (
    <Card className="mt-6">
      <CardContent className="p-0">
        <div className="border-b border-border p-5">
          <h3 className="text-base font-semibold text-foreground">Condition comparison</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {`Advisory only. Property condition materially affects cost. The selected condition (${selectedCondition}) remains the working estimate. Alternative rows are not saved automatically.`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Advisory cost comparison by property condition. The selected condition remains the
              working estimate.
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-5 py-3 font-medium">
                  Condition
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Mid estimate
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Range
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.condition}
                  className={
                    row.selected
                      ? "border-b border-border bg-accent/5 last:border-0"
                      : "border-b border-border last:border-0"
                  }
                >
                  <th scope="row" className="px-5 py-3 text-left font-medium text-foreground">
                    <span className="inline-flex items-center gap-2">
                      {row.condition}
                      {row.selected ? <Badge variant="outline">Current estimate</Badge> : null}
                    </span>
                  </th>
                  <td className="px-5 py-3 tabular-nums text-foreground">
                    {formatGbp(row.pricing.mid_total)}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-muted-foreground">
                    {formatGbp(row.pricing.low_total)} – {formatGbp(row.pricing.high_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
