# Analysis Paths Strategy

**Date:** June 2026  
**Status:** Pure TypeScript + OpenAI via feature slices and `src/platform/`.

## Current State

All AI analysis (photo vision, scope, estimates, redesign) runs through **TanStack
`createServerFn`** handlers in feature-slice `presentation/` layers, with OpenAI
adapters in `infrastructure/` importing `@/platform/openai/server`.

| Capability        | Slice       | ServerFn                           |
| ----------------- | ----------- | ---------------------------------- |
| Photo vision      | `ai-upload` | `runPhotoAnalysisServerFn`         |
| Scope analysis    | `ai-design` | `runScopeAnalysisServerFn`         |
| Redesign concepts | `ai-design` | `generateRedesignConceptsServerFn` |
| AI estimates      | `estimate`  | `generateEstimateServerFn`         |

Legacy barrel: `src/core/ai/serverFns.ts` re-exports all three slices.

**Characteristics:**

- Zod input validation + `requireServerAuth()` on every RPC
- `gpt-4o` with JSON output + post-validation (Zod) + retries (`src/core/ai/platform/retry.ts`)
- Graceful fallbacks when `OPENAI_API_KEY` is absent (`source: "mock" | "fallback"`)
- Estimate normalization via `src/core/ai/normalizers.ts` → `@repo/services` pricing authority
- Multi-step orchestration: `src/core/ai/platform/orchestrator.ts` (vision→scope→estimate)

**Railway/Python backend:** fully decommissioned. See
[archive](../archive/2026-05-legacy-ai-guidance-railway/).

## Integration Points

- **Projects:** Upload → vision → scope → estimate (or AIEstimateBuilder with normalization)
- **Deal Copilot:** Deterministic `analyzeDeal` is authoritative; optional AI estimate via `generateEstimateServerFn`
- **Reports:** Persisted analysis + deterministic pricing/ROI; AI for narrative only
- **Financial invariant:** ROI/score always use `runPricingEngine().mid_total` — never raw AI costs

## Fallbacks & Error Handling

- Server: timeout (60–90s), rate limits, parse errors → classified + Sentry + safe fallback
- Client: hooks expose `isPending` / `isError`; toasts on failure
- `source` tagging: `"ai" | "mock" | "fallback" | "persisted"`

## Related

- [AI Platform](./ai-platform.md)
- [Feature-Slice Architecture](./FEATURE_SLICE.md)
- [Platform Boundary](./platform-boundary.md)
- [`CLAUDE.md`](../../CLAUDE.md)
