/**
 * L1EstimateForm — three-field progressive estimate entry.
 *
 * Postcode + condition chips + intent chips → runL1Estimate (pure engine path).
 * Presentation never computes money; it only calls the application use-case
 * and renders CostSummary with the result.
 */
import { useState } from "react";
import { Button, Input, Label, Badge } from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import {
  L1_CONDITION_OPTIONS,
  L1_INTENT_OPTIONS,
  type L1ConditionChip,
  type L1IntentChip,
  type L1UserInput,
} from "../../domain/l1Policy";
import { runL1Estimate, type L1EstimateResult } from "../../application/runL1Estimate";
import { CostSummary } from "./CostSummary";

export type L1EstimateFormProps = {
  className?: string;
  /** Optional callback when an estimate is produced (e.g. analytics). */
  onEstimated?: (result: L1EstimateResult) => void;
};

export function L1EstimateForm({ className, onEstimated }: L1EstimateFormProps) {
  const [postcode, setPostcode] = useState("");
  const [condition, setCondition] = useState<L1ConditionChip | null>(null);
  const [intent, setIntent] = useState<L1IntentChip | null>(null);
  const [result, setResult] = useState<L1EstimateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    postcode.trim().length >= 2 && condition != null && intent != null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!condition || !intent) {
      setError("Select condition and what you are doing.");
      return;
    }

    const input: L1UserInput = {
      postcode: postcode.trim(),
      condition,
      intent,
    };

    try {
      const next = runL1Estimate(input);
      setResult(next);
      onEstimated?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate estimate");
      setResult(null);
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="l1-postcode">Postcode</Label>
          <Input
            id="l1-postcode"
            name="postcode"
            autoComplete="postal-code"
            placeholder="e.g. CV1 2WT"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            className="max-w-xs"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Condition</legend>
          <div className="flex flex-wrap gap-2">
            {L1_CONDITION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCondition(opt.value)}
                className="focus-visible:outline-none"
              >
                <Badge
                  variant={condition === opt.value ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1 text-sm"
                >
                  {opt.label}
                </Badge>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">What are you doing?</legend>
          <div className="flex flex-wrap gap-2">
            {L1_INTENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setIntent(opt.value)}
                className="focus-visible:outline-none"
              >
                <Badge
                  variant={intent === opt.value ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1 text-sm"
                >
                  {opt.label}
                </Badge>
              </button>
            ))}
          </div>
        </fieldset>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={!canSubmit}>
          Get estimate
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
