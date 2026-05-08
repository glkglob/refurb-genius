import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EstimateTable } from "@/components/EstimateTable";
import { ArrowRight, Calculator, Clock, PoundSterling, TrendingUp, Wallet, Home, Banknote, Percent, Gauge, ShieldAlert } from "lucide-react";
import { projectStore, type UKRegion } from "@/core/projects";
import { type ConditionLevel } from "@/core/ai";
import { calculateEstimate, formatGBP, type EstimateCategory, type FinishLevel } from "@/core/pricing";
import { runRoiEngine, type RoiRiskLevel as RiskLevel } from "@/core/roi";
import {
  UK_REGIONS,
  CONDITION_LEVELS,
  ESTIMATE_CATEGORIES,
  FINISH_LEVELS,
  DISCLAIMER,
} from "@/core/constants";

export const Route = createFileRoute("/projects/$id/estimate")({
  head: () => ({ meta: [{ title: "Cost estimate — Refurb Genius" }] }),
  component: EstimatePage,
});

const DEFAULT_CATEGORIES: EstimateCategory[] = [
  "Kitchen",
  "Bathroom",
  "Flooring",
  "Painting",
  "Electrical",
];

function EstimatePage() {
  const { id } = Route.useParams();
  const project = projectStore.get(id);

  const [region, setRegion] = useState<UKRegion>(project?.region ?? "London");
  const [condition, setCondition] = useState<ConditionLevel>("Dated");
  const [finish, setFinish] = useState<FinishLevel>("Standard");
  const [categories, setCategories] = useState<EstimateCategory[]>(DEFAULT_CATEGORIES);

  const result = useMemo(
    () => calculateEstimate({ region, condition, finish, categories }),
    [region, condition, finish, categories],
  );

  const metrics = useMemo(() => {
    if (!project) return null;
    const roi = runRoiEngine({
      purchase_price: project.purchase_price,
      refurb_budget: result.mid_total,
      estimated_gdv: project.estimated_gdv,
      rental_income: 0,
      holding_costs: 0,
      region,
      property_condition: condition,
    });
    return {
      refurb_budget: result.mid_total,
      total_cost: roi.total_project_cost,
      estimated_profit: roi.estimated_profit,
      roi: roi.roi,
      yield_pct: roi.gross_yield,
      rental_uplift_annual: roi.rental_uplift,
      rental_uplift_monthly: Math.round(roi.rental_uplift / 12),
      investment_score: roi.investment_score,
      risk_level: roi.risk_level,
    };
  }, [project, result, region, condition]);

  function toggleCategory(cat: EstimateCategory, checked: boolean) {
    setCategories((prev) =>
      checked ? [...prev, cat] : prev.filter((c) => c !== cat),
    );
  }

  return (
    <AppLayout
      title="Cost estimate"
      subtitle="Region, condition and finish-aware UK refurbishment calculator."
      actions={
        <Button
          asChild
          onClick={() => projectStore.setStage(id, "estimate", true)}
        >
          <Link to="/projects/$id/report" params={{ id }}>
            View investor report <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      }
    >
      {/* Inputs */}
      <Card>
        <CardContent className="grid gap-5 p-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Region</Label>
            <Select value={region} onValueChange={(v) => setRegion(v as UKRegion)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UK_REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Condition level</Label>
            <Select value={condition} onValueChange={(v) => setCondition(v as ConditionLevel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONDITION_LEVELS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Finish quality</Label>
            <Select value={finish} onValueChange={(v) => setFinish(v as FinishLevel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FINISH_LEVELS.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3">
            <Label className="mb-3 block">Categories to include</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {ESTIMATE_CATEGORIES.map((cat) => {
                const checked = categories.includes(cat);
                return (
                  <label
                    key={cat}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-3 text-sm hover:bg-accent/5"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleCategory(cat, Boolean(v))}
                    />
                    <span className="text-foreground">{cat}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<PoundSterling className="h-4 w-4" />}
          label="Mid estimate"
          value={formatGBP(result.mid_total)}
          hint={`Range ${formatGBP(result.low_total)} – ${formatGBP(result.high_total)}`}
          highlight
        />
        <SummaryCard
          icon={<Calculator className="h-4 w-4" />}
          label="Subtotal (ex VAT)"
          value={formatGBP(result.subtotal)}
          hint={`Labour ${formatGBP(result.labour_total)} · Materials ${formatGBP(result.materials_total)}`}
        />
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Contingency + VAT"
          value={formatGBP(result.contingency + result.vat)}
          hint={`10% contingency · 20% VAT`}
        />
        <SummaryCard
          icon={<Clock className="h-4 w-4" />}
          label="Timeline"
          value={`${result.timeline_weeks} wks`}
          hint={`Multiplier ×${result.multiplier}`}
        />
      </div>

      {/* Investor metrics */}
      {metrics && project && (
        <div className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Investor metrics
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Live ROI, profit, rental uplift and risk based on your inputs.
              </p>
            </div>
            <Badge variant="outline" className="hidden sm:inline-flex">
              GDV {formatGBP(project.estimated_gdv)}
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={<Wallet className="h-4 w-4" />}
              label="Refurb budget"
              value={formatGBP(metrics.refurb_budget)}
              hint="Mid estimate inc. VAT"
            />
            <SummaryCard
              icon={<Home className="h-4 w-4" />}
              label="Total project cost"
              value={formatGBP(metrics.total_cost)}
              hint={`Purchase ${formatGBP(project.purchase_price)} + refurb`}
            />
            <SummaryCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Estimated GDV"
              value={formatGBP(project.estimated_gdv)}
              hint={`Rental uplift ${formatGBP(metrics.rental_uplift_monthly)}/mo`}
            />
            <SummaryCard
              icon={<Banknote className="h-4 w-4" />}
              label="Estimated profit"
              value={formatGBP(metrics.estimated_profit)}
              hint={`After all costs`}
              highlight={metrics.estimated_profit > 0}
            />
            <SummaryCard
              icon={<Percent className="h-4 w-4" />}
              label="ROI"
              value={`${metrics.roi}%`}
              hint={`Yield ${metrics.yield_pct}%`}
            />
            <SummaryCard
              icon={<Gauge className="h-4 w-4" />}
              label="Investment score"
              value={`${metrics.investment_score} / 10`}
              hint="ROI 70% · yield 30%"
            />
            <RiskCard risk={metrics.risk_level} />
            <Card className="border-dashed">
              <CardContent className="flex h-full flex-col justify-between gap-3 p-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Ready to share?
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    Generate a polished investor report with these numbers.
                  </p>
                </div>
                <Button asChild size="sm" onClick={() => projectStore.setStage(id, "estimate", true)}>
                  <Link to="/projects/$id/report" params={{ id }}>
                    View report <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Itemised table */}
      <Card className="mt-8">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <h3 className="text-base font-semibold text-foreground">Itemised breakdown</h3>
              <p className="text-sm text-muted-foreground">
                Per-category labour and materials at the chosen region, condition and finish.
              </p>
            </div>
            <Badge variant="outline">{result.items.length} categories</Badge>
          </div>

          {result.items.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Select at least one category to generate an estimate.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Labour</TableHead>
                  <TableHead className="text-right">Materials</TableHead>
                  <TableHead className="text-right">Weeks</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((i) => (
                  <TableRow key={i.category}>
                    <TableCell className="font-medium text-foreground">{i.category}</TableCell>
                    <TableCell className="text-right">{formatGBP(i.labour)}</TableCell>
                    <TableCell className="text-right">{formatGBP(i.materials)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{i.weeks}</TableCell>
                    <TableCell className="text-right font-semibold">{formatGBP(i.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-medium">Subtotal</TableCell>
                  <TableCell className="text-right">{formatGBP(result.labour_total)}</TableCell>
                  <TableCell className="text-right">{formatGBP(result.materials_total)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-semibold">{formatGBP(result.subtotal)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">Contingency (10%)</TableCell>
                  <TableCell className="text-right">{formatGBP(result.contingency)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">VAT (20%)</TableCell>
                  <TableCell className="text-right">{formatGBP(result.vat)}</TableCell>
                </TableRow>
                <TableRow className="bg-muted/40">
                  <TableCell colSpan={4} className="font-semibold text-foreground">Mid total</TableCell>
                  <TableCell className="text-right text-base font-semibold text-foreground">
                    {formatGBP(result.mid_total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-muted-foreground">{DISCLAIMER}</p>
    </AppLayout>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-accent/40 bg-accent/5" : undefined}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {icon} {label}
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function RiskCard({ risk }: { risk: RiskLevel }) {
  const tone =
    risk === "Low"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
      : risk === "Moderate"
      ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
      : "border-destructive/30 bg-destructive/5 text-destructive";
  return (
    <Card className={tone}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide opacity-80">
          <ShieldAlert className="h-4 w-4" /> Risk level
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{risk}</p>
        <p className="mt-1 text-xs opacity-80">
          {risk === "Low"
            ? "Strong fundamentals across ROI and yield."
            : risk === "Moderate"
            ? "Workable deal — verify costs on site."
            : "Margins are tight. Renegotiate or rework scope."}
        </p>
      </CardContent>
    </Card>
  );
}
