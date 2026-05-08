# Core — Shared Platform Layer

Reusable, product-agnostic business logic powering Refurb Genius today and
future products (Deal Copilot, Refurb IQ) tomorrow.

Rules:
- Pure logic only. No React, no routing, no UI primitives.
- Pages and components consume `@/core/*` instead of duplicating calculations.
- Each module owns its types and constants and re-exports them.
- `src/lib/*` files remain as the canonical implementations and are
  re-exported here so existing imports keep working during the transition.

Modules:
- `projects`   — project entity, store, derived helpers
- `pricing`    — refurbishment estimate engine (categories, multipliers, calc)
- `roi`        — investor metrics (ROI, profit, score, risk, rental uplift)
- `reports`    — report-level constants (disclaimer) and helpers
- `ai`         — mock AI analysis + redesign concept generation
- `types`      — shared cross-module types
- `constants`  — shared cross-module constants
