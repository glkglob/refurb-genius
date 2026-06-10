# Validation Results

- ✅ `pnpm typecheck`
- ✅ `pnpm lint` (required one formatting fix in `src/routes/__root.tsx`)
- ✅ `pnpm test:invariants`
- ✅ `pnpm test:ui` (all tests passed; existing Recharts width/height warning in chart test output)
- ✅ `pnpm build:vercel`

---

# Feature Slice Status

| Slice     | Status       | Notes                                                                    |
| --------- | ------------ | ------------------------------------------------------------------------ |
| estimate  | Standardized | Public barrel + infrastructure barrel present; invariant checks pass.    |
| ai-upload | Standardized | Public barrel + infrastructure barrel present; invariant checks pass.    |
| ai-design | Standardized | Public barrel + infrastructure barrel present; invariant checks pass.    |
| export    | Scaffolded   | Public barrel + infrastructure barrel present; layered structure exists. |
| payment   | Scaffolded   | Scaffold present with public API barrel.                                 |
| gallery   | Scaffolded   | Scaffold present with public API barrel.                                 |

Boundary checks run:

- `tests/invariants/feature-slice.invariant.test.ts` passing (layer rules and API barrel checks).
- No forbidden deep imports found for `estimate|ai-upload|ai-design|export` domain/application/presentation/internal infrastructure paths.

---

# Legacy Boundary Violations

Scan used:

- `grep -R "@/lib/" src`
- `grep -R "@/services/" src`
- `grep -R "@/core/" src`
- `grep -R "@/integrations/" src`

Violation rule applied for this report: imports outside allowed exception roots:

- `src/features/**`
- `src/platform/**`
- `src/core/**`
- `src/lib/**`
- `src/services/**`
- `src/types/**`

## `@/lib/*` outside allowed roots (64 files)

`src/components/AIFeedbackWidget.tsx`  
`src/components/AIMetricsDashboard.tsx`  
`src/components/BulkPhotoUpload.tsx`  
`src/components/DashboardSection.tsx`  
`src/components/EstimateBuilder.tsx`  
`src/components/MetricCard.tsx`  
`src/components/MobileTopBar.tsx`  
`src/components/PlatformNavButtons.tsx`  
`src/components/SensitivityAnalysis.tsx`  
`src/components/Sidebar.tsx`  
`src/components/StatusBadge.tsx`  
`src/components/deal-copilot/DealCopilotFeedback.tsx`  
`src/components/deal-copilot/DealEstimateSection.tsx`  
`src/components/deal-copilot/DealIntakeForm.tsx`  
`src/components/deal-copilot/DealMetricsGrid.tsx`  
`src/components/deal-copilot/DealRiskFlags.tsx`  
`src/components/deal-copilot/DealScoreCard.tsx`  
`src/components/deal-copilot/DealSummarySection.tsx`  
`src/components/floorplan/FloorplanScene.tsx`  
`src/components/floorplan/FloorplanViewer.tsx`  
`src/components/gallery/LeadCaptureForm.tsx`  
`src/components/gallery/ProjectCard.tsx`  
`src/components/gallery/PublishToGallery.tsx`  
`src/components/marketplace/MessagingInbox.tsx`  
`src/components/marketplace/QuoteRequestDialog.tsx`  
`src/components/marketplace/TradepersonCard.tsx`  
`src/components/photos/PhotoAnalysisCard.tsx`  
`src/components/photos/PhotoAnalysisViewer.tsx`  
`src/components/pitch-deck/PitchDeckGenerator.tsx`  
`src/components/ui/accordion.tsx`  
`src/components/ui/button.tsx`  
`src/components/ui/input.tsx`  
`src/components/ui/label.tsx`  
`src/components/ui/separator.tsx`  
`src/components/ui/skeleton.tsx`  
`src/components/ui/textarea.tsx`  
`src/hooks/useAuth.ts`  
`src/hooks/useGallery.ts`  
`src/hooks/useOpportunities.ts`  
`src/hooks/useProjects.ts`  
`src/hooks/useRole.ts`  
`src/routes/__root.tsx`  
`src/routes/_authed.tsx`  
`src/routes/_authed/admin.tsx`  
`src/routes/_authed/dashboard.tsx`  
`src/routes/_authed/deal-copilot/$opportunityId.tsx`  
`src/routes/_authed/marketplace.tsx`  
`src/routes/_authed/projects.$id.analysis.tsx`  
`src/routes/_authed/projects.$id.estimate.tsx`  
`src/routes/_authed/projects.$id.index.tsx`  
`src/routes/_authed/projects.$id.report.tsx`  
`src/routes/_authed/projects.$id.scope.tsx`  
`src/routes/_authed/projects.$id.upload.tsx`  
`src/routes/_authed/projects.new.tsx`  
`src/routes/_authed/settings.tsx`  
`src/routes/_authed/trades_.new.tsx`  
`src/routes/auth.tsx`  
`src/routes/auth_.callback.tsx`  
`src/routes/gallery.$slug.tsx`  
`src/routes/gallery.tsx`  
`src/serverFns/auth.ts`  
`src/serverFns/dealCopilot.ts`  
`src/serverFns/projects.ts`  
`src/start.ts`

## `@/services/*` outside allowed roots (6 files)

`src/routes/_authed/dashboard.tsx`  
`src/routes/_authed/trades_.$jobId_.edit.tsx`  
`src/routes/_authed/trades_.new.tsx`  
`src/routes/_authed/trades_.profile.tsx`  
`src/routes/trades.tsx`  
`src/routes/trades_.$jobId.tsx`

## `@/core/*` outside allowed roots (27 files)

`src/components/AIEstimateBuilder.tsx`  
`src/components/AppLayout.tsx`  
`src/components/EstimateBuilder.tsx`  
`src/components/EstimateTable.tsx`  
`src/components/ProjectCard.tsx`  
`src/components/RedesignCard.tsx`  
`src/components/deal-copilot/DealIntakeForm.tsx`  
`src/components/gallery/LeadCaptureForm.tsx`  
`src/components/platform/ProductCard.tsx`  
`src/hooks/useOpportunities.ts`  
`src/routes/_authed/dashboard.tsx`  
`src/routes/_authed/deal-copilot/$opportunityId.edit.tsx`  
`src/routes/_authed/deal-copilot/index.tsx`  
`src/routes/_authed/projects.$id.analysis.tsx`  
`src/routes/_authed/projects.$id.estimate.tsx`  
`src/routes/_authed/projects.$id.index.tsx`  
`src/routes/_authed/projects.$id.report.tsx`  
`src/routes/_authed/projects.$id.scope.tsx`  
`src/routes/_authed/projects.$id.upload.tsx`  
`src/routes/_authed/projects.new.tsx`  
`src/routes/_authed/settings.tsx`  
`src/routes/_authed/trades_.$jobId_.edit.tsx`  
`src/routes/_authed/trades_.new.tsx`  
`src/routes/_authed/trades_.profile.tsx`  
`src/routes/index.tsx`  
`src/routes/trades.tsx`  
`src/routes/trades_.$jobId.tsx`

## `@/integrations/*` outside allowed roots

None found.

---

# Public API Violations

Audited entry points:

- `src/core/ai/index.ts`
- `src/lib/estimate.ts`
- `src/integrations/supabase/client.ts`

## Importers and compliance

### `src/core/ai/index.ts`

Importers:

- `src/components/AIEstimateBuilder.tsx`
- `src/components/deal-copilot/DealIntakeForm.tsx`

Assessment:

- ✅ Importers use the public barrel path (`@/core/ai`) and not private internals.
- ⚠️ Transitional only: these usages are still in legacy app-shell/components rather than feature presentation seams.

### `src/lib/estimate.ts`

Importers:

- `src/core/pricing/index.ts`

Assessment:

- ✅ Public path usage.
- ⚠️ Transitional compatibility shim still present (`core/pricing` re-exporting from `lib/estimate`).

### `src/integrations/supabase/client.ts`

Importers:

- None found.

Assessment:

- ✅ No active consumption.
- ⚠️ Candidate for removal once deprecation window closes.

---

# Export Slice Review

Path audited: `src/features/export`.

## Layer presence

- ✅ `domain/`
- ✅ `application/`
- ✅ `infrastructure/`
- ✅ `presentation/`
- ✅ public barrel `src/features/export/index.ts`
- ✅ infrastructure barrel `src/features/export/infrastructure/index.ts`

## Layer dependency assessment

- Domain imports only local types plus legacy type-only contracts from `@/lib/exportPdf` and `@/lib/pitchDeck`.
- Application imports domain/ports only.
- Infrastructure imports application ports.
- Presentation imports application + infrastructure (wiring), matching allowed pattern.

## Circular dependency check

- No circular dependencies were observed in the audited import graph.

## Deep import / legacy coupling findings

- No forbidden cross-slice deep imports detected for export internals.
- ⚠️ Legacy coupling remains in export domain types to `@/lib/exportPdf` and `@/lib/pitchDeck`.

---

# Documentation Review

File reviewed: `docs/architecture/FEATURE_SLICE.md`

Checks:

- ✅ No merge conflict markers found.
- ✅ Top migration table includes `payment` and `gallery` as `Scaffolded`.
- ✅ `export` is marked `Scaffolded`.
- ✅ Commit references are preserved in top migration table for standardized slices.
- ⚠️ Inconsistency found: lower progress table (`lines ~577+`) still shows old statuses (`export ◐`, `gallery —`), conflicting with top migration table.
- ⚠️ “Known deep-import debt” section states remediated items; should be refreshed to current, active debt only.

Required doc updates:

1. Align lower progress table with top status table.
2. Replace historical/remediated deep-import debt list with current open debt.
3. Add explicit note that no active importers remain for `src/integrations/supabase/client.ts` (if retained intentionally).

---

# Remaining Technical Debt

Prioritized:

1. Legacy import cleanup in routes/hooks/components/serverFns (`@/lib/*`, `@/core/*`, `@/services/*` outside allowed roots).
2. Route-level migration onto feature and platform APIs (especially trades + project routes).
3. Hook-level migration (`useAuth`, `useGallery`, `useProjects`, `useOpportunities`, `useRole`) off legacy barrels.
4. Export slice domain decoupling from `@/lib/exportPdf` and `@/lib/pitchDeck`.
5. Remove or archive unused `src/integrations/supabase/client.ts`.

---

# Recommended Next Sprint

1. Legacy import cleanup
2. Route migration
3. Hook migration
4. Payments foundation
5. Gallery slice

---

# Summary Metrics

- Files changed (this validation pass):
  - `src/routes/__root.tsx` (lint formatting fix)
  - `reports/architecture-validation-report.md` (new)
- Tests added: none
- Violations fixed during this run: 1 lint formatting violation
- Violations remaining: legacy boundary violations listed above (64 `@/lib`, 6 `@/services`, 27 `@/core` outside allowed roots)
- Overall architecture health score: **78 / 100**
