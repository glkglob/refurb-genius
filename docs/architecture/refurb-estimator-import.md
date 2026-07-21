# Import from refurb-estimator

**Source:** [glkglob/refurb-estimator](https://github.com/glkglob/refurb-estimator)  
**Target package:** `@repo/services`  
**Date:** 2026-07-21

## What was imported (pure domain only)

Next.js UI, Prisma, Stripe, Qdrant, and App Router code were **not** copied.
Only deterministic TypeScript engines that fit Refurb Genius’s financial-authority model.

| Module | Path in Genius | Source in estimator |
|--------|----------------|---------------------|
| UK postcode → region | `packages/services/src/uk-region/` | `enhanced-estimator-calculator.postcodeToRegion` |
| Cost library (£/m² + regional multipliers) | `packages/services/src/cost-library/` | `lib/cost-library.ts` |
| Trade day rates (2026) | `packages/services/src/trade-rates/` | `lib/pricing/trade-rates.ts` |
| SDLT + development appraisal / BRRR | `packages/services/src/development-appraisal/` | `features/development/domain/development-appraisal.ts` |
| Enhanced scope-based refurb estimate + feature add-ons | `packages/services/src/enhanced-estimate/` | `enhanced-estimator-calculator.ts` (simplified) |
| New-build £/m² estimate | `packages/services/src/new-build/` | `new-build-calculator.ts` (simplified) |

## What was intentionally left out

- Next.js App Router pages and API routes
- Prisma schema / Postgres dual-stack
- Stripe payment intents & webhooks
- Qdrant / embeddings search
- Commercial kitchen quantity UX paths
- Supplier price overrides (needs DB)
- Full extension/loft specialist calculators (can port later)
- Jest/Playwright suites (logic covered by Genius invariant tests)

## How to use

```ts
import {
  runEnhancedEstimate,
  runNewBuildEstimate,
  calculateDevelopmentAppraisal,
  calculateStampDutyLandTax,
  estimateLabourCost,
  postcodeToUkRegion,
  TRADE_RATES,
} from "@repo/services";
```

**Authority note:** `runPricingEngine` remains the canonical engine for category-based refurb totals used by Deal Copilot ROI. Enhanced / new-build engines are additional products; do not silently replace `pricing.mid_total` without an explicit product decision.

## Tests

`tests/invariants/estimator-engines.invariant.test.ts` — postcode, labour, SDLT, appraisal, enhanced, new-build.

## UI wiring (2026-07-21)

| Surface | Component / route | What it shows |
|---------|-------------------|---------------|
| Deal Copilot | `DealAcquisitionCosts` on intake form | SDLT (+ surcharge) and development appraisal when purchase/GDV/refurb set |
| Trades post job | `LabourRateGuide` on `/trades/new` | Regional labour mid/low/high for selected category |
| Quote dialog | `LabourRateGuide` (compact) | Labour guide when requesting a quote |
| Project estimate | Tabs **Enhanced scope** + **New build** | Scope £/m² + features; new-build £/m² by type/spec |

Authority unchanged: **Quick estimate** + Deal Copilot ROI still use `runPricingEngine` only.

## Follow-ups

1. Optional: prefill job budget min/max from labour guide mid band.
2. Align `REGION_MULTIPLIERS` in `pricingData.ts` with cost-library values if product wants a single regional table.
3. Persist enhanced/new-build results to project estimates if product needs them in reports.
