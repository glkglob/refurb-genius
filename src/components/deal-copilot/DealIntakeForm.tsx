import { useEffect, useMemo, useState } from "react";
import { Calculator, CheckCircle2, CircleAlert, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { trackDealAnalyzed } from "@/lib/analytics";

import { useGenerateEstimate } from "@/features/estimate";
import type { GenerateEstimateInput, AIGeneratedRoom } from "@/core/ai";
import { getRegionalMultiplier, calculateLineItem, calculateEstimateTotals } from "@/core/pricing";

import { Card, CardContent } from "@/components/ui/card";
import { logger } from "@/lib/logger";
import { CONDITION_LEVELS, type ConditionLevel } from "@/features/ai-upload/domain";
import { UK_REGIONS, type UKRegion } from "@/lib/projects";
import { formatGBP } from "@/lib/utils";
import {
  createDealOpportunity,
  saveDealOpportunity,
  scoreDealOpportunity,
  type DealOpportunity,
  type DealScoreInput,
  type DealScoreResult,
} from "@/core/dealCopilot";
import { analyzeDeal } from "@/lib/deal-copilot/dealAnalysis";
import { validateFormData } from "@/lib/deal-copilot/dealValidation";
import { DealScoreCard } from "@/components/deal-copilot/DealScoreCard";
import { DealMetricsGrid } from "@/components/deal-copilot/DealMetricsGrid";
import { DealRiskFlags } from "@/components/deal-copilot/DealRiskFlags";
import { DealEstimateSection } from "@/components/deal-copilot/DealEstimateSection";
import { Button } from "@repo/ui";

type DealFormState = {
  title: string;
  listingUrl: string;
  postcode: string;
  purchasePrice: string;
  estimatedGdv: string;
  expectedMonthlyRent: string;
  refurbBudget: string;
  holdingCosts: string;
  region: UKRegion;
  propertyCondition: ConditionLevel;
};

const initialState: DealFormState = {
  title: "",
  listingUrl: "",
  postcode: "",
  purchasePrice: "",
  estimatedGdv: "",
  expectedMonthlyRent: "",
  refurbBudget: "",
  holdingCosts: "",
  region: "London",
  propertyCondition: "Average",
};

function parseMoney(value: string): number | undefined {
  const trimmed = value.trim();
  const firstMinus = trimmed.indexOf("-");

  if (firstMinus > 0 || trimmed.indexOf("-", firstMinus + 1) !== -1) {
    return undefined;
  }

  const sign = firstMinus === 0 ? "-" : "";
  const normalised = sign + trimmed.replace(/[^0-9.]/g, "");

  if ((normalised.match(/\./g) ?? []).length > 1) {
    return undefined;
  }

  const parsed = Number(normalised);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function formatPercent(value: number | null | undefined) {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function hasSameDealOpportunityInputs(first: DealOpportunity | null, second: DealOpportunity) {
  return Boolean(
    first &&
    first.title === second.title &&
    first.listingUrl === second.listingUrl &&
    first.postcode === second.postcode &&
    first.purchasePrice === second.purchasePrice &&
    first.estimatedGdv === second.estimatedGdv &&
    first.expectedMonthlyRent === second.expectedMonthlyRent &&
    first.refurbBudget === second.refurbBudget,
  );
}

export function DealIntakeForm() {
  const [form, setForm] = useState<DealFormState>(initialState);
  const [savedOpportunity, setSavedOpportunity] = useState<DealOpportunity | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // AI estimate via native TS serverFn (OpenAI). Declare early so useEffects below can reference without TDZ.
  const generateAiEstimate = useGenerateEstimate();

  const scoreInput = useMemo<DealScoreInput>(
    () => ({
      title: form.title.trim(),
      listingUrl: form.listingUrl.trim() || undefined,
      postcode: form.postcode.trim() || undefined,
      purchasePrice: parseMoney(form.purchasePrice),
      estimatedGdv: parseMoney(form.estimatedGdv),
      expectedMonthlyRent: parseMoney(form.expectedMonthlyRent),
      refurbBudget: parseMoney(form.refurbBudget),
      holdingCosts: parseMoney(form.holdingCosts) ?? 0,
      region: form.region,
      propertyCondition: form.propertyCondition,
    }),
    [form],
  );

  const score = useMemo<DealScoreResult>(() => scoreDealOpportunity(scoreInput), [scoreInput]);

  // Basic telemetry for key user actions (Phase 3)
  useEffect(() => {
    if (score.ready) {
      trackDealAnalyzed("deal-copilot");
    }
  }, [score.ready]);

  useEffect(() => {
    if (generateAiEstimate.data && generateAiEstimate.data.length > 0) {
      trackDealAnalyzed("deal-copilot-ai-estimate");
    }
  }, [generateAiEstimate.data]);

  // Run full analysis through orchestration layer
  const validationResult = useMemo(
    () =>
      validateFormData({
        title: form.title,
        purchasePrice: form.purchasePrice,
        estimatedGdv: form.estimatedGdv,
        expectedMonthlyRent: form.expectedMonthlyRent,
        refurbBudget: form.refurbBudget,
        region: form.region,
        propertyCondition: form.propertyCondition,
        holdingCosts: form.holdingCosts,
      }),
    [form],
  );

  const analysis = useMemo(() => {
    if (!validationResult.valid) {
      return null;
    }
    return analyzeDeal(validationResult.data);
  }, [validationResult]);

  const aiEstimateResult = generateAiEstimate.data;
  const aiMultiplier = getRegionalMultiplier(form.region);
  const normalizedAiEstimate = useMemo(() => {
    if (!aiEstimateResult?.length) return null;
    const rooms = aiEstimateResult.map((room: AIGeneratedRoom) => ({
      name: room.name,
      area_sqm: room.area_sqm,
      items: room.items.map((item) => calculateLineItem(item, aiMultiplier)),
    }));
    const allItems = rooms.flatMap((r) => r.items);
    const totals = calculateEstimateTotals(allItems);
    return { rooms, totals };
  }, [aiEstimateResult, aiMultiplier]);

  async function handleRunAiEstimate() {
    if (!form.postcode && !form.listingUrl) {
      logger.warn("[deal-intake] AI analysis requires postcode or listing url");
      return;
    }
    // Map form data to TS AI estimate input (no photos in Deal Copilot; text-only path)
    const input: GenerateEstimateInput = {
      propertyType: "House",
      bedrooms: 3, // reasonable default for deal intel; user can refine in Projects
      bathrooms: undefined,
      region: form.region,
      postcode: form.postcode.trim() || undefined,
      condition: form.propertyCondition,
      requirements: form.listingUrl
        ? `Listing: ${form.listingUrl}`
        : "Standard good quality modern refurb for investment",
      sizeSqm: undefined,
    };
    generateAiEstimate.mutate(input, {
      onError: (err) => {
        logger.error("[deal-intake] AI estimate failed", { error: err });
      },
    });
  }

  async function handleSaveOpportunity() {
    if (!score.ready || isSaving) {
      if (isSaving) {
        logger.debug("[deal-intake] Save already in progress, ignoring duplicate click");
      }
      return;
    }

    const opportunity = createDealOpportunity({
      title: scoreInput.title,
      listingUrl: scoreInput.listingUrl,
      postcode: scoreInput.postcode,
      purchasePrice: scoreInput.purchasePrice,
      estimatedGdv: scoreInput.estimatedGdv,
      expectedMonthlyRent: scoreInput.expectedMonthlyRent,
      refurbBudget: scoreInput.refurbBudget,
    });

    if (hasSameDealOpportunityInputs(savedOpportunity, opportunity)) {
      logger.debug("[deal-intake] Save skipped: identical to last saved opportunity");
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    logger.info("[deal-intake] Starting save", { title: opportunity.title });
    try {
      const saved = await saveDealOpportunity(opportunity);
      setSavedOpportunity(saved);
      setSaveError(null);
      logger.info("[deal-intake] Save successful", { id: saved.id });
      toast.success("Opportunity saved", {
        description: "View it in Deal Copilot or create a full project for photo analysis.",
      });
    } catch (err) {
      // Show the real error from serverFn (e.g. RLS violation, "You must be signed in.",
      // or DB error) instead of always swallowing into a generic message.
      // This makes debugging (and user feedback) specific as required.
      const message =
        err instanceof Error ? err.message : "Unable to save opportunity. Please try again.";
      const displayMessage = message.includes("save opportunity")
        ? message
        : `Unable to save opportunity: ${message}`;
      setSaveError(displayMessage);
      logger.error("[deal-intake] Save failed", { error: String(err), displayMessage });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">Deal assumptions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the minimum underwriting inputs. Deal Copilot uses the shared ROI engine for
                score, profit, yield, and risk.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Deal title"
                value={form.title}
                onChange={(title) => setForm((current) => ({ ...current, title }))}
                placeholder="3-bed terrace in Croydon"
              />

              <TextInput
                label="Listing URL"
                value={form.listingUrl}
                onChange={(listingUrl) => setForm((current) => ({ ...current, listingUrl }))}
                placeholder="https://..."
              />

              <TextInput
                label="Postcode / area"
                value={form.postcode}
                onChange={(postcode) => setForm((current) => ({ ...current, postcode }))}
                placeholder="CR0"
              />

              <SelectInput
                label="Region"
                value={form.region}
                options={UK_REGIONS}
                onChange={(region) => setForm((current) => ({ ...current, region }))}
              />

              <MoneyInput
                label="Purchase price"
                value={form.purchasePrice}
                onChange={(purchasePrice) => setForm((current) => ({ ...current, purchasePrice }))}
                placeholder="350000"
              />

              <MoneyInput
                label="Estimated GDV"
                value={form.estimatedGdv}
                onChange={(estimatedGdv) => setForm((current) => ({ ...current, estimatedGdv }))}
                placeholder="475000"
              />

              <MoneyInput
                label="Refurb budget"
                value={form.refurbBudget}
                onChange={(refurbBudget) => setForm((current) => ({ ...current, refurbBudget }))}
                placeholder="55000"
              />

              <MoneyInput
                label="Expected monthly rent"
                value={form.expectedMonthlyRent}
                onChange={(expectedMonthlyRent) =>
                  setForm((current) => ({ ...current, expectedMonthlyRent }))
                }
                placeholder="2200"
              />

              <MoneyInput
                label="Holding costs"
                value={form.holdingCosts}
                onChange={(holdingCosts) => setForm((current) => ({ ...current, holdingCosts }))}
                placeholder="8000"
              />

              <SelectInput
                label="Property condition"
                value={form.propertyCondition}
                options={CONDITION_LEVELS}
                onChange={(propertyCondition) =>
                  setForm((current) => ({ ...current, propertyCondition }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Full analysis results below form, inside left column */}
        {analysis && analysis.ready && (
          <div className="space-y-6">
            <DealMetricsGrid roi={analysis.roi} />
            <DealRiskFlags roi={analysis.roi} />
            <DealEstimateSection pricing={analysis.pricing} />
          </div>
        )}

        {/* AI estimate via native TypeScript + OpenAI pipeline */}
        <div className="mt-4 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRunAiEstimate}
            disabled={generateAiEstimate.isPending || (!form.postcode && !form.listingUrl)}
          >
            <Zap className="mr-1 h-4 w-4" />
            {generateAiEstimate.isPending
              ? "Running AI estimate..."
              : "Run AI Property Estimate (TypeScript + OpenAI)"}
          </Button>
          {generateAiEstimate.isPending && (
            <div className="mt-2 text-xs">
              Status: <span className="font-medium">processing</span>
            </div>
          )}
          {generateAiEstimate.isError && (
            <div className="mt-2 text-xs text-destructive">
              {generateAiEstimate.error?.message?.includes("Rate limit")
                ? generateAiEstimate.error.message
                : `AI estimate failed: ${generateAiEstimate.error?.message || "Unknown error"}`}
            </div>
          )}
          {normalizedAiEstimate && (
            <div className="mt-3 rounded-xl border border-border/70 bg-card p-4 text-sm shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold tracking-tight text-foreground">
                    AI cost estimate
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-400">
                    ADVISORY ONLY
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  ×{aiMultiplier.toFixed(2)} regional multiplier
                </span>
              </div>

              <div className="space-y-3">
                {normalizedAiEstimate.rooms.slice(0, 3).map((room, i) => (
                  <div key={i} className="rounded-lg border border-border/50 bg-background p-3">
                    <div className="mb-2 flex items-baseline justify-between">
                      <div className="font-medium text-foreground">
                        {room.name}
                        {room.area_sqm ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({room.area_sqm} m²)
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">{room.items.length} items</div>
                    </div>
                    <div className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                      {room.items.slice(0, 4).map((item, j) => (
                        <div key={j} className="flex justify-between text-muted-foreground">
                          <span className="truncate pr-2">{item.name}</span>
                          <span className="font-medium tabular-nums text-foreground/90">
                            {formatGBP(item.total_cost)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {room.items.length > 4 && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        +{room.items.length - 4} more line items…
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {normalizedAiEstimate.rooms.length > 3 && (
                <div className="mt-1.5 text-xs text-muted-foreground">
                  +{normalizedAiEstimate.rooms.length - 3} more rooms in full project…
                </div>
              )}

              <div className="mt-3 border-t pt-3">
                <div className="flex items-baseline justify-between font-semibold text-foreground">
                  <span>Est. materials + labour (ex. VAT)</span>
                  <span className="text-lg tabular-nums">
                    {formatGBP(normalizedAiEstimate.totals.subtotal)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                  Text-only advisory starting point. For precise room-by-room costs with photo
                  analysis, open a full Project (uses the same deterministic pricing engine + full
                  AI scope).
                </p>
                <div className="mt-2 text-right">
                  <a
                    href="/projects/new"
                    className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                  >
                    Start a full project for photo-based estimates →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="self-start lg:sticky lg:top-6">
        <DealScorePanel
          score={score}
          savedOpportunity={savedOpportunity}
          saveError={saveError}
          isSaving={isSaving}
          onSaveOpportunity={handleSaveOpportunity}
        />
      </aside>
    </div>
  );
}

function DealScorePanel({
  score,
  savedOpportunity,
  saveError,
  isSaving,
  onSaveOpportunity,
}: {
  score: DealScoreResult;
  savedOpportunity: DealOpportunity | null;
  saveError: string | null;
  isSaving: boolean;
  onSaveOpportunity: () => Promise<void>;
}) {
  const result = score.roiResult;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
            {score.ready ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <CircleAlert className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Deal Copilot score
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">{score.recommendation}</h2>
          </div>
        </div>

        {!score.ready && score.missingFields.length > 0 ? (
          <div className="mt-6">
            <p className="text-sm font-medium text-foreground">
              Complete these fields to calculate your score:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {score.missingFields.map((field) => (
                <span
                  key={field}
                  className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200"
                >
                  {field}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3">
          <MetricRow label="Total project cost" value={formatGBP(result?.total_project_cost)} />
          <MetricRow label="Estimated profit" value={formatGBP(result?.estimated_profit)} />
          <MetricRow label="ROI" value={formatPercent(result?.roi)} />
          <MetricRow label="Gross yield" value={formatPercent(result?.gross_yield)} />
          <MetricRow label="Rental uplift" value={formatGBP(result?.rental_uplift)} />
          <MetricRow
            label="Investment score"
            value={result ? `${result.investment_score}/10` : "—"}
          />
          <MetricRow label="Risk level" value={result?.risk_level ?? "—"} />
        </div>

        <button
          type="button"
          disabled={!score.ready || isSaving}
          onClick={() => {
            void onSaveOpportunity();
          }}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSaving ? "Saving…" : "Save opportunity"}
        </button>

        {saveError ? (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {saveError}
          </p>
        ) : null}

        {savedOpportunity ? (
          <p className="mt-3 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
            Saved opportunity: {savedOpportunity.title}
          </p>
        ) : null}

        <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-4 text-sm leading-6 text-muted-foreground">
          <Calculator className="mb-3 h-4 w-4 text-accent" />
          AI will later explain the recommendation. The financial figures here are deterministic
          outputs from the shared ROI engine.
        </div>
      </CardContent>
    </Card>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
    </label>
  );
}

function MoneyInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return <TextInput {...props} />;
}

function SelectInput<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: TValue;
  options: readonly TValue[];
  onChange: (value: TValue) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as TValue)}
        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary/30 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
