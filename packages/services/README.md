# @repo/services — shared domain services

Reusable **business logic engines** for the Intelligent Platform.

> Applications own product workflows. **This package owns reusable domain engines.**

## Rules

| Must be | Must not be |
|---------|-------------|
| Deterministic (money paths) | React / JSX |
| Framework-independent | Route-aware |
| UI-free | App-feature imports (`src/features`, `apps/*`) |
| Callable from any app / serverFn / test | Owner of product UX |

Features **orchestrate** these engines. Engines never know which application called them.

## Modules (current)

| Path | Role |
|------|------|
| `pricing/` | Authoritative category refurb pricing (`runPricingEngine` → `mid_total`) |
| `roi/` | Authoritative ROI (`runRoiEngine`; budget = pricing mid_total) |
| `enhanced-estimate/`, `new-build/` | Advisory estimating engines |
| `deal-analysis/` | Deal scoring (after pricing + ROI) |
| `cost-library/`, `trade-rates/`, `uk-region/`, `development-appraisal/` | Supporting calculators / data |
| `ai/` | Pure helpers only if present — vendor clients belong in platform `ai` |

Target logical grouping (see platform plan): `pricing`, `roi`, `estimating`, `reports`,
`valuation`, `image-analysis`, `calculators`.

## Usage

```ts
import { runPricingEngine, runRoiEngine } from "@repo/services";

const pricing = runPricingEngine(inputs);
const roi = runRoiEngine({
  purchase_price: ...,
  refurb_budget: pricing.mid_total, // never invent a parallel budget
  gdv: ...,
});
```

## Docs

- [Platform architecture plan](../../docs/architecture/platform-architecture-plan.md) — § Shared domain services  
- [Package boundaries](../../docs/architecture/package-boundaries.md)  
- Pricing / ROI invariants under `tests/invariants/`  
