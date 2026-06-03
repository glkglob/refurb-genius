import { useMemo, useState } from "react";
import { Calculator, CheckCircle2, CircleAlert, Zap } from "lucide-react";

// // PRIMARY PATH usage in Deal Copilot (heavy analysis).
// When postcode/address present, user can trigger Railway primary heavy intel job.
import { useRailwayPropertyAnalysis } from "@/hooks/useRailwayPropertyAnalysis";
import type { PropertyAnalysisInput } from "@/lib/api/railwayAnalysis";

import { Card, CardContent } from "@/components/ui/card";
import { logger } from "@/lib/logger";
import { CONDITION_LEVELS, type ConditionLevel } from "@/lib/analysis";
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

  // PRIMARY heavy path integration in Deal Copilot (when address data present).
  // Button below triggers Railway async job (primary for heavy intel) + shows result.
  const {
    start: startHeavy,
    status: heavyStatus,
    result: heavyResult,
    error: heavyError,
    isPolling: heavyPolling,
  } = useRailwayPropertyAnalysis();

  async function handleRunHeavyAnalysis() {
    if (!form.postcode && !form.listingUrl) {
      logger.warn("[deal-intake] Heavy analysis requires postcode or listing url");
      return;
    }
    const heavyInput: PropertyAnalysisInput = {
      postcode: form.postcode.trim() || undefined,
      property_address: form.listingUrl.trim() || undefined,
      region: form.region,
      // property_type omitted (DealIntakeForm uses propertyCondition; optional in backend model)
      purchase_price: parseMoney(form.purchasePrice) ?? undefined,
      estimated_gdv: parseMoney(form.estimatedGdv) ?? undefined,
      condition: form.propertyCondition,
      notes: "Triggered from Deal Copilot intake (primary Railway path)",
    };
    await startHeavy(heavyInput);
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

        {/* Heavy analysis via PRIMARY Railway path (Deal Copilot integration) */}
        <div className="mt-4 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRunHeavyAnalysis}
            disabled={heavyPolling || (!form.postcode && !form.listingUrl)}
          >
            <Zap className="mr-1 h-4 w-4" />
            {heavyPolling
              ? "Running heavy analysis..."
              : "Run Heavy Property Intel (Primary Railway)"}
          </Button>
          {heavyStatus !== "idle" && (
            <div className="mt-2 text-xs">
              Status: <span className="font-medium">{heavyStatus}</span>
              {heavyError && <span className="ml-2 text-destructive">Error: {heavyError}</span>}
            </div>
          )}
          {heavyResult && (
            <div className="mt-2 rounded border bg-muted/50 p-3 text-xs">
              <div className="font-medium">Heavy Analysis Result (Railway primary)</div>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[10px]">
                {JSON.stringify(heavyResult, null, 2)}
              </pre>
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
          className="mt-6 w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
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
