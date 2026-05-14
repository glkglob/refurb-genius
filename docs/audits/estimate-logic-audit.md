# Estimate Logic Audit

## Purpose

This audit records where estimate, refurb cost, profit, ROI, yield, and related financial calculations currently live.

The goal is to avoid accidental duplicate logic while Refurb Genius moves toward a canonical shared report and financial engine layer.

## Files Reviewed

| File                                             | Current Role                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `src/core/pricing/pricingEngine.ts`              | Canonical refurb cost engine                                       |
| `src/core/roi/roiEngine.ts`                      | Canonical ROI, profit, yield, score, and risk engine               |
| `src/core/dealCopilot/dealScore.ts`              | Deal scoring wrapper that delegates to `runRoiEngine`              |
| `src/lib/estimate.ts`                            | Legacy wrapper around `runPricingEngine`                           |
| `src/lib/metrics.ts`                             | Deprecated investor metrics helper with duplicate ROI/profit logic |
| `src/lib/projects.ts`                            | Rough project fallback helpers                                     |
| `src/core/projects/projectHelpers.ts`            | Re-exports project helper functions                                |
| `src/routes/projects.$id.report.tsx`             | Reads pre-computed report values                                   |
| `src/routes/projects.$id.index.tsx`              | Uses project fallback helpers                                      |
| `src/components/deal-copilot/DealIntakeForm.tsx` | Collects inputs and passes them to Deal Copilot scoring            |

## Canonical Engines

### Refurb Cost

Canonical location:

`src/core/pricing/pricingEngine.ts`

Canonical function:

`runPricingEngine`

This engine handles deterministic refurb pricing logic, including:

- Per-category costing
- Region multipliers
- Property condition multipliers
- Finish-level multipliers
- Contingency
- VAT
- Low/mid/high estimate range

### ROI / Profit / Yield / Score

Canonical location:

`src/core/roi/roiEngine.ts`

Canonical function:

`runRoiEngine`

This engine should remain the source of truth for:

- Profit
- ROI percentage
- Gross yield
- Rental uplift
- Investment score
- Risk level

## Duplicated or Overlapping Logic

### Deprecated Investor Metrics

Location:

`src/lib/metrics.ts`

Issue:

`calculateInvestorMetrics()` duplicates some of the ROI/profit/yield logic that now belongs in `runRoiEngine`.

Current status:

- Deprecated
- Should not be used for new work
- Should be migrated carefully after confirming all callsites have the required `runRoiEngine` inputs

Risk:

Deleting this too early may break report routes or older project views.

### Project Rough Fallback Helpers

Location:

`src/lib/projects.ts`

Helpers:

- `estimatedRefurbCost()`
- `estimatedProfit()`

Issue:

These are rough fallback helpers and do not use the canonical pricing engine.

Current status:

- Acceptable as display-only fallback logic
- Should not be treated as canonical estimate logic
- Should be clearly labelled if edited later

Risk:

Replacing these directly with `runPricingEngine` is not safe unless the project object has the required pricing inputs.

## Current Recommendation

Do not refactor yet.

Keep the current canonical split:

| Domain                                | Canonical Home                      |
| ------------------------------------- | ----------------------------------- |
| Refurb cost calculation               | `src/core/pricing/pricingEngine.ts` |
| ROI / profit / yield / score          | `src/core/roi/roiEngine.ts`         |
| Deal scoring                          | `src/core/dealCopilot/dealScore.ts` |
| Rough project fallback display values | `src/lib/projects.ts`               |

## Future Refactor Plan

When starting the Deal Copilot integration phase:

1. Find all `calculateInvestorMetrics()` callsites.
2. Confirm each callsite has enough input data for `runRoiEngine`.
3. Replace safe callsites with `runRoiEngine`.
4. Keep fallback helpers in `src/lib/projects.ts` until proper project estimate inputs exist.
5. Delete `calculateInvestorMetrics()` only after all callsites are removed.
6. Add tests around `runRoiEngine` before deleting deprecated metrics logic.

## Safety Rules

- Do not create another estimate engine.
- Do not add new ROI/profit formulas inside React components.
- Do not add new financial formulas inside route files.
- Use `runPricingEngine` for refurb cost logic.
- Use `runRoiEngine` for ROI/profit/yield/score logic.
- Keep fallback display helpers clearly separate from canonical engines.
