import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { AppLayout } from "@/components/AppLayout";
import { LoadingState } from "@/components/LoadingState";
import { AIEstimateBuilder } from "@/components/AIEstimateBuilder";
import { EstimateBuilder } from "@/components/EstimateBuilder";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui";
import { EstimateTable } from "@/components/EstimateTable";
import {
  ArrowRight,
  Calculator,
  Clock,
  PoundSterling,
  Sparkles,
  TrendingUp,
  Wallet,
  Home,
  Banknote,
  Percent,
  Gauge,
  ShieldAlert,
  GripVertical,
} from "lucide-react";
import { type UKRegion } from "@/core/projects";
import { type ConditionLevel } from "@/features/ai-upload";
import type { ScopeRoom } from "@/features/ai-design";
import { useProject, useSetProjectStage, type ProjectWithProgress } from "@/hooks/useProjects";
import {
  runPricingEngine,
  formatGBP,
  type EstimateCategory,
  type FinishLevel,
} from "@/core/pricing";
import { runRoiEngine, type RoiRiskLevel as RiskLevel } from "@/features/roi";
import { logger } from "@/lib/logger";
import { saveProjectEstimate } from "@/features/estimate/infrastructure";
import { trackEvent } from "@/lib/analytics";
import {
  UK_REGIONS,
  CONDITION_LEVELS,
  ESTIMATE_CATEGORIES,
  FINISH_LEVELS,
  DISCLAIMER,
} from "@/core/constants";

export const Route = createFileRoute("/_authed/projects/$id/estimate")({
  head: () => ({ meta: [{ title: "Cost estimate — Refurb Genius" }] }),
  component: EstimatePage,
  validateSearch: (search: Record<string, unknown>) => ({
    from: search.from === "scope" ? ("scope" as const) : undefined,
  }),
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
  const { data: project, isLoading, error } = useProject(id);

  if (isLoading) {
    return (
      <AppLayout title="Cost estimate" subtitle="Loading project details…">
        <LoadingState label="Loading project…" />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Cost estimate" subtitle="Failed to load project">
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <p className="text-sm font-medium text-foreground">Failed to load project details.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error.message ?? "Please try again."}
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  if (!project) return <Navigate to="/dashboard" />;

  return <EstimateContent id={id} project={project} />;
}

function EstimateContent({ id, project }: { id: string; project: ProjectWithProgress }) {
  const navigate = useNavigate();
  const setStage = useSetProjectStage();
  const { from } = Route.useSearch();

  // Read scope rooms from sessionStorage when navigating from scope analysis
  const scopeRooms = useMemo<ScopeRoom[] | undefined>(() => {
    if (from !== "scope") return undefined;
    try {
      const raw = sessionStorage.getItem(`scope-rooms:${id}`);
      if (!raw) return undefined;
      sessionStorage.removeItem(`scope-rooms:${id}`); // consume once
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ScopeRoom[]) : undefined;
    } catch {
      return undefined;
    }
  }, [from, id]);

  const [region, setRegion] = useState<UKRegion>(project.region);
  const [condition, setCondition] = useState<ConditionLevel>("Dated");
  const [finish, setFinish] = useState<FinishLevel>("Standard");
  const [categories, setCategories] = useState<EstimateCategory[]>(DEFAULT_CATEGORIES);

  useEffect(() => {
    trackEvent("estimate_viewed");
  }, []);

  useEffect(() => {
    setRegion(project.region);
  }, [project.region]);

  const result = useMemo(
    () =>
      runPricingEngine({
        region,
        property_condition: condition,
        finish_quality: finish,
        selected_categories: categories,
        property_size_sqm: project.size_sqm,
      }),
    [region, condition, finish, categories, project.size_sqm],
  );

  const metrics = useMemo(() => {
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
    setCategories((prev) => (checked ? [...prev, cat] : prev.filter((c) => c !== cat)));
  }

  async function handleReportClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    try {
      if (project) {
        await saveProjectEstimate(id, result);
      }

      setStage.mutate({ id, stage: "estimate", value: true });
      navigate({ to: "/projects/$id/report", params: { id } });
    } catch (err) {
      logger.error("[estimates] save failed", { error: String(err) });
      return;
    }
  }

  return (
    <AppLayout
      title="Cost estimate"
      subtitle="Region, condition and finish-aware UK refurbishment calculator."
      actions={
        <Button asChild>
          <Link to="/projects/$id/report" params={{ id }} onClick={handleReportClick}>
            View investor report <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      }
    >
      <Tabs defaultValue={scopeRooms ? "ai" : "quick"}>
        <TabsList className="mb-6">
          <TabsTrigger value="quick">
            <Calculator className="mr-1.5 h-4 w-4" /> Quick estimate
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="mr-1.5 h-4 w-4" /> AI estimate
          </TabsTrigger>
          <TabsTrigger value="builder">
            <GripVertical className="mr-1.5 h-4 w-4" /> Builder (drag & drop)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai">
          <AIEstimateBuilder
            projectId={id}
            propertyType={project.property_type}
            bedrooms={project.bedrooms}
            bathrooms={project.bathrooms}
            sizeSqm={project.size_sqm}
            initialRegion={project.region}
            postcode={project.postcode}
            initialScopeRooms={scopeRooms}
            onSaved={() => {
              setStage.mutate({ id, stage: "estimate", value: true });
            }}
          />
        </TabsContent>

        <TabsContent value="builder">
          <EstimateBuilder
            projectId={id}
            project={project}
            onSaved={() => {
              setStage.mutate({ id, stage: "estimate", value: true });
            }}
          />
        </TabsContent>

        <TabsContent value="quick">
          {/* Inputs */}
          <Card>
            <CardContent className="grid gap-5 p-6 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Region</Label>
                <Select value={region} onValueChange={(v) => setRegion(v as UKRegion)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UK_REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Condition level</Label>
                <Select value={condition} onValueChange={(v) => setCondition(v as ConditionLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_LEVELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Finish quality</Label>
                <Select value={finish} onValueChange={(v) => setFinish(v as FinishLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINISH_LEVELS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
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
          {metrics && (
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
                    <Button asChild size="sm">
                      <Link to="/projects/$id/report" params={{ id }} onClick={handleReportClick}>
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
                <Badge variant="outline">{result.lineItems.length} categories</Badge>
              </div>

              <EstimateTable
                items={result.lineItems}
                labour_total={result.labour_total}
                materials_total={result.materials_total}
                subtotal={result.subtotal}
                contingency={result.contingency}
                vat={result.vat}
                mid_total={result.mid_total}
              />
            </CardContent>
          </Card>

          <p className="mt-6 text-xs text-muted-foreground">{DISCLAIMER}</p>
        </TabsContent>
      </Tabs>
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
