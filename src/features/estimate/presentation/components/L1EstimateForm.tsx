/**
 * L1EstimateForm — progressive L1 → L2 estimate entry.
 *
 * Closed details → runL1Estimate.
 * Open details → runL2Estimate (finish / size / optional categories).
 * Presentation never computes money; it only calls application use-cases
 * and renders CostSummary with the result.
 */
import { useId, useState, type FormEvent } from "react";
import { Button, Input, Label, cn } from "@repo/ui";
import type { EstimateCategory } from "@repo/types";
import {
  L1_CONDITION_OPTIONS,
  L1_INTENT_OPTIONS,
  L2_MAX_SIZE_SQM,
  L2_MIN_SIZE_SQM,
  categoriesFromIntent,
  type L1ConditionChip,
  type L1IntentChip,
  type L1UserInput,
} from "../../domain";
import {
  runL1Estimate,
  runL2Estimate,
  type L1EstimateResult,
  type L2EstimateResult,
} from "../../application";
import { CostSummary } from "./CostSummary";
import { L2DetailsFields, type L2DetailsErrors, type L2DetailsValue } from "./L2DetailsFields";

export type ProgressiveEstimateResult = L1EstimateResult | L2EstimateResult;

export type L1EstimateFormProps = {
  className?: string;
  /** Optional callback when an estimate is produced (e.g. analytics). */
  onEstimated?: (result: ProgressiveEstimateResult) => void;
};

const EMPTY_DETAILS: L2DetailsValue = {
  finish: null,
  propertySize: "",
  categoryRefinementEnabled: false,
  categories: [],
};

function parseSizeInput(raw: string): { size?: number; error?: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return {};
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    return { error: "Enter a valid property size in square metres." };
  }
  if (n < L2_MIN_SIZE_SQM || n > L2_MAX_SIZE_SQM) {
    return {
      error: `Property size must be between ${L2_MIN_SIZE_SQM} and ${L2_MAX_SIZE_SQM} m².`,
    };
  }
  return { size: n };
}

export function L1EstimateForm({ className, onEstimated }: L1EstimateFormProps) {
  const detailsPanelId = useId();
  const [postcode, setPostcode] = useState("");
  const [condition, setCondition] = useState<L1ConditionChip | null>(null);
  const [intent, setIntent] = useState<L1IntentChip | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState<L2DetailsValue>(EMPTY_DETAILS);
  const [result, setResult] = useState<ProgressiveEstimateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<L2DetailsErrors>({});

  const canSubmit = postcode.trim().length >= 2 && condition != null && intent != null;

  function invalidateResult() {
    setResult(null);
    setError(null);
    setFieldErrors({});
  }

  function updatePostcode(value: string) {
    invalidateResult();
    setPostcode(value);
  }

  function updateCondition(value: L1ConditionChip) {
    invalidateResult();
    setCondition(value);
  }

  function updateIntent(value: L1IntentChip) {
    invalidateResult();
    setIntent(value);
    setDetails((prev) => {
      if (!prev.categoryRefinementEnabled) return prev;
      return {
        ...prev,
        categories: categoriesFromIntent(value),
      };
    });
  }

  function updateDetails(next: L2DetailsValue) {
    invalidateResult();
    setDetails(next);
  }

  function handleDetailsToggle() {
    setDetailsOpen((open) => !open);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!condition || !intent) {
      setError("Select condition and what you are doing.");
      return;
    }

    const postcodeTrimmed = postcode.trim();

    try {
      let next: ProgressiveEstimateResult;

      if (!detailsOpen) {
        const input: L1UserInput = {
          postcode: postcodeTrimmed,
          condition,
          intent,
        };
        next = runL1Estimate(input);
      } else {
        const sizeParse = parseSizeInput(details.propertySize);
        const nextFieldErrors: L2DetailsErrors = {};
        if (sizeParse.error) nextFieldErrors.propertySize = sizeParse.error;
        if (details.categoryRefinementEnabled && details.categories.length === 0) {
          nextFieldErrors.categories =
            "Select at least one work category, or turn off category refinement.";
        }
        if (Object.keys(nextFieldErrors).length > 0) {
          setFieldErrors(nextFieldErrors);
          return;
        }

        next = runL2Estimate({
          postcode: postcodeTrimmed,
          condition,
          intent,
          finish: details.finish ?? undefined,
          property_size_sqm: sizeParse.size,
          categories: details.categoryRefinementEnabled
            ? (details.categories as EstimateCategory[])
            : undefined,
        });
      }

      setResult(next);
      setError(null);

      // Callback isolation: analytics must not clear a valid estimate
      if (onEstimated) {
        try {
          onEstimated(next);
        } catch {
          // swallow — optional consumer failure must not affect form state
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate estimate");
      setResult(null);
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="l1-postcode">Postcode</Label>
          <Input
            id="l1-postcode"
            name="postcode"
            autoComplete="postal-code"
            placeholder="e.g. CV1 2WT"
            value={postcode}
            onChange={(e) => updatePostcode(e.target.value)}
            className="max-w-xs"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "l1-estimate-error" : undefined}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Condition</legend>
          <div className="flex flex-wrap gap-2">
            {L1_CONDITION_OPTIONS.map((opt) => {
              const selected = condition === opt.value;
              return (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  aria-pressed={selected}
                  onClick={() => updateCondition(opt.value)}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">What are you doing?</legend>
          <div className="flex flex-wrap gap-2">
            {L1_INTENT_OPTIONS.map((opt) => {
              const selected = intent === opt.value;
              return (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  aria-pressed={selected}
                  onClick={() => updateIntent(opt.value)}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={detailsOpen}
            aria-controls={detailsPanelId}
            onClick={handleDetailsToggle}
          >
            {detailsOpen ? "Hide extra detail" : "Add more detail"}
          </Button>

          {detailsOpen && (
            <div id={detailsPanelId}>
              <L2DetailsFields
                value={details}
                errors={fieldErrors}
                intent={intent}
                onChange={updateDetails}
              />
            </div>
          )}
        </div>

        {error && (
          <p id="l1-estimate-error" className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={!canSubmit}>
          {detailsOpen ? "Update estimate" : "Get estimate"}
        </Button>
      </form>

      {result && (
        <CostSummary
          mid={result.pricing.mid_total}
          low={result.pricing.low_total}
          high={result.pricing.high_total}
          labour={result.pricing.labour_total}
          materials={result.pricing.materials_total}
          contingency={result.pricing.contingency}
          vat={result.pricing.vat}
          confidence={result.displayConfidence}
          source={result.source}
          drivers={result.keyDrivers}
          assumptions={result.assumptions}
          warnings={result.pricing.warnings}
        />
      )}
    </div>
  );
}
