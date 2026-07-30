/**
 * L2 progressive-detail fields — finish, size, optional category refinement.
 *
 * Controlled presentation only. Does not run estimates or compute money.
 */
import { Button, Checkbox, Input, Label, cn } from "@repo/ui";
import { ESTIMATE_CATEGORIES, type EstimateCategory, type FinishLevel } from "@repo/types";
import {
  L2_FINISH_OPTIONS,
  L2_MAX_SIZE_SQM,
  L2_MIN_SIZE_SQM,
  categoriesFromIntent,
  type L1IntentChip,
} from "../../domain";

export type L2DetailsValue = {
  finish: FinishLevel | null;
  propertySize: string;
  categoryRefinementEnabled: boolean;
  categories: EstimateCategory[];
};

export type L2DetailsErrors = {
  propertySize?: string;
  categories?: string;
};

export type L2DetailsFieldsProps = {
  value: L2DetailsValue;
  errors?: L2DetailsErrors;
  intent: L1IntentChip | null;
  onChange: (value: L2DetailsValue) => void;
  className?: string;
};

export function L2DetailsFields({
  value,
  errors,
  intent,
  onChange,
  className,
}: L2DetailsFieldsProps) {
  const sizeErrorId = "l2-size-error";
  const sizeHelpId = "l2-size-help";
  const categoriesErrorId = "l2-categories-error";

  function setFinish(finish: FinishLevel) {
    onChange({ ...value, finish });
  }

  function setPropertySize(propertySize: string) {
    onChange({ ...value, propertySize });
  }

  function setCategoryRefinementEnabled(enabled: boolean) {
    if (enabled) {
      const seeded = intent ? categoriesFromIntent(intent) : [];
      onChange({
        ...value,
        categoryRefinementEnabled: true,
        categories: seeded,
      });
      return;
    }
    onChange({
      ...value,
      categoryRefinementEnabled: false,
      categories: [],
    });
  }

  function toggleCategory(category: EstimateCategory, checked: boolean) {
    const next = checked
      ? ESTIMATE_CATEGORIES.filter((c) => value.categories.includes(c) || c === category)
      : value.categories.filter((c) => c !== category);
    onChange({ ...value, categories: next });
  }

  return (
    <div className={cn("space-y-5 rounded-xl border border-border bg-card/40 p-4", className)}>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Finish quality</legend>
        <div className="flex flex-wrap gap-2">
          {L2_FINISH_OPTIONS.map((opt) => {
            const selected = value.finish === opt.value;
            return (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                aria-pressed={selected}
                onClick={() => setFinish(opt.value)}
              >
                {opt.label}
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Optional. Standard is assumed if unset.</p>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="l2-property-size">Floor area (m²)</Label>
        <Input
          id="l2-property-size"
          name="propertySize"
          type="number"
          inputMode="numeric"
          min={L2_MIN_SIZE_SQM}
          max={L2_MAX_SIZE_SQM}
          step={1}
          placeholder="e.g. 90"
          value={value.propertySize}
          onChange={(e) => setPropertySize(e.target.value)}
          className="max-w-xs"
          aria-invalid={Boolean(errors?.propertySize)}
          aria-describedby={errors?.propertySize ? `${sizeHelpId} ${sizeErrorId}` : sizeHelpId}
        />
        <p id={sizeHelpId} className="text-xs text-muted-foreground">
          Typical flat: around 70–90 m². House: often 90–150 m². Accepted range {L2_MIN_SIZE_SQM}–
          {L2_MAX_SIZE_SQM} m².
        </p>
        {errors?.propertySize && (
          <p id={sizeErrorId} className="text-sm text-destructive" role="alert">
            {errors.propertySize}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id="l2-refine-categories"
            checked={value.categoryRefinementEnabled}
            disabled={intent == null}
            onCheckedChange={(checked) => setCategoryRefinementEnabled(checked)}
            aria-controls={value.categoryRefinementEnabled ? "l2-category-group" : undefined}
          />
          <div className="space-y-1">
            <Label htmlFor="l2-refine-categories" className="font-medium">
              Refine work categories
            </Label>
            <p className="text-xs text-muted-foreground">
              {intent == null
                ? "Select an intent above first."
                : "Optional. Starts from your intent and lets you add or remove work areas."}
            </p>
          </div>
        </div>

        {value.categoryRefinementEnabled && (
          <fieldset
            id="l2-category-group"
            className="space-y-2 rounded-lg border border-border p-3"
            aria-describedby={errors?.categories ? categoriesErrorId : undefined}
          >
            <legend className="px-1 text-sm font-medium">Work categories</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ESTIMATE_CATEGORIES.map((category) => {
                const checked = value.categories.includes(category);
                const id = `l2-category-${category.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`;
                return (
                  <div key={category} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(next) => toggleCategory(category, next)}
                    />
                    <Label htmlFor={id} className="font-normal">
                      {category}
                    </Label>
                  </div>
                );
              })}
            </div>
            {errors?.categories && (
              <p id={categoriesErrorId} className="text-sm text-destructive" role="alert">
                {errors.categories}
              </p>
            )}
          </fieldset>
        )}
      </div>
    </div>
  );
}
