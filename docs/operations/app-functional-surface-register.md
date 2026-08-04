# Application Functional Surface Register

**Programme:** P0-APP — Full Application Operational Readiness and Remediation  
**Phase:** P0-APP-A — Complete Functional Surface Inventory  
**Branch:** `audit/p0-app-operational-baseline`  
**Baseline main SHA:** `b2041176bfbcc9aea83cffd69da8161884638deb`  
**Inventory date:** 2026-08-04  
**Inventory method:** Static code inspection of `src/routes/**`, shared layout/nav components, feature presentation hooks, and server functions. Runtime browser verification is **not** complete in this phase.

> **Controlling principle:** A feature is not operational because its page renders. Statuses below that are not backed by runtime or automated evidence remain `NOT_TESTED` or are limited to code-confirmed defects.

Machine-readable twin: [`app-functional-surface-register.json`](./app-functional-surface-register.json).

---

## 1. Scope and exclusions

### In scope

- All production routes under `src/routes/**`
- Production navigation (Sidebar, Navbar, PlatformNavButtons, Footer, MobileTopBar)
- Production-visible interactive controls on those routes and their primary feature components
- Server functions / persistence adapters that back those surfaces
- External integrations referenced by production paths

### Explicitly paused / out of scope for this programme body of work

- 4C2E evidence-vault authoring
- Catalogue publication / D1 implementation
- Production catalogue data activation
- Merging outstanding unreviewed repair PRs without independent verification

### Related outstanding repair (not on main)

| Item | Detail |
| --- | --- |
| Draft PR #104 | `fix/p0-property-photo-capture-upload` @ `fe407ccc…` — photo capture/upload repair, **not merged** into main |
| Main photo state | Main still contains the P0 photo defects listed below |

---

## 2. Status vocabulary

| Status | Meaning |
| --- | --- |
| `WORKING` | Runtime or automated evidence that the control completes its intended outcome |
| `BROKEN` | Confirmed defective behaviour (code and/or runtime) |
| `PARTIAL` | Some path works; known gaps, missing feedback, or incomplete persistence |
| `INACCESSIBLE` | Present but cannot be used (role, entitlement, overlay, silent disable) |
| `BLOCKED_CONFIGURATION` | Requires missing/invalid app configuration |
| `BLOCKED_EXTERNAL` | Depends on external provider/sandbox not verified |
| `INTENTIONALLY_HIDDEN` | Hidden or removed because not ready / role-gated |
| `NOT_TESTED` | Inventoried; no runtime verification yet |

**Severity:** `P0` core journey / auth / data safety · `P1` major production feature · `P2` secondary · `P3` cosmetic.

No production-visible control may remain `NOT_TESTED` at **programme close**. At end of P0-APP-A many correctly remain `NOT_TESTED`.

---

## 3. Route inventory summary

**Route source files (product routes):** 36 file routes under `src/routes` (excluding `__root` layout plumbing and pure test files).

| Path | Source | Auth | Role / entitlement | Primary ops | Nav entry | Tests | Status notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | `index.tsx` | Public | — | Marketing CTAs | Logo, public | None dedicated | `NOT_TESTED` |
| `/auth` | `auth.tsx` | Public | — | AuthExperience (signin/signup/OAuth/reset) | Navbar | `AuthExperience.test.tsx` + hooks | `PARTIAL` — unit coverage; E2E `NOT_TESTED` |
| `/auth/callback` | `auth_.callback.tsx` | Public | — | OAuth/magic-link completion | Provider redirect | `useAuthCallbackCompletion.test.ts` | `NOT_TESTED` runtime |
| `/oauth/consent` | `oauth.consent.tsx` | Public | — | Consent copy + sign-in links | OAuth flow | None | `NOT_TESTED` |
| `/privacy` | `privacy.tsx` | Public | — | Static content + mailto | Footer | None | `NOT_TESTED` |
| `/terms` | `terms.tsx` | Public | — | Static content | Footer | None | `NOT_TESTED` |
| `/support` | `support.tsx` | Public | — | FAQ + mailto; some “coming soon” copy | Footer/settings | None | `PARTIAL` — export help says coming soon |
| `/gallery` | `gallery.tsx` | Public | — | List published projects | Public/marketing | gallery hooks tests | `NOT_TESTED` runtime |
| `/gallery/$slug` | `gallery.$slug.tsx` | Public | — | Detail + contact anchor | Gallery list | None | `NOT_TESTED` |
| `/trades` | `trades.tsx` | Public (+ auth CTAs) | — | Job list, filters, post-job CTAs | Sidebar/Navbar | None route-level | `PARTIAL` — “coming soon” badge while marketplace functional |
| `/trades/$jobId` | `trades_.$jobId.tsx` | Mixed | Owner vs visitor | Detail, interest, accept/reject | Trades list | None | `NOT_TESTED` |
| `/_authed/*` layout | `_authed.tsx` | **Required** | Authenticated user via `getCurrentUserServerFn` | Redirect to `/auth` | — | Layout comment/docs | Auth gate `NOT_TESTED` E2E |
| `/dashboard` | `_authed/dashboard.tsx` | Auth | — | Projects, jobs, onboarding goal | Sidebar | `dashboard.test.tsx` (goal only) | `NOT_TESTED` full UI |
| `/analyze` | `_authed/analyze.tsx` | Auth | — | Guided feasibility + photos + export | Sidebar “New Study” | None on main for route | **P0 BROKEN photos** (see §5) |
| `/studies` | `_authed/studies.tsx` | Auth | — | Study list / project filter | Sidebar | None | `NOT_TESTED` |
| `/studies/$id` | `_authed/studies.$id.tsx` | Auth | Owner (RLS) | Study detail, share links, export | Studies list | None | `NOT_TESTED` |
| `/projects/new` | `_authed/projects.new.tsx` | Auth | — | Create project (`createProjectServerFn`) | Dashboard CTAs | None | `NOT_TESTED` |
| `/projects/$id` | `_authed/projects.$id.index.tsx` | Auth | Owner | Detail, stages, publish gallery | Project links | None | `NOT_TESTED` |
| `/projects/$id/upload` | `_authed/projects.$id.upload.tsx` | Auth | Owner | Dedicated photo upload | Project pipeline | photo-upload ops docs | Camera single-file OK; full runtime `NOT_TESTED` |
| `/projects/$id/analysis` | `_authed/projects.$id.analysis.tsx` | Auth | Owner | Vision analysis + stage | Pipeline | None | `NOT_TESTED` / AI may be `BLOCKED_EXTERNAL` |
| `/projects/$id/scope` | `_authed/projects.$id.scope.tsx` | Auth | Owner | Scope analysis | Pipeline | None | `NOT_TESTED` |
| `/projects/$id/estimate` | `_authed/projects.$id.estimate.tsx` | Auth | Owner | Estimate + live ROI | Pipeline | estimate hooks | `NOT_TESTED` full page |
| `/projects/$id/report` | `_authed/projects.$id.report.tsx` | Auth | Owner | Report / export / PDF | Pipeline | export hooks | `NOT_TESTED` |
| `/estimate/instant` | `_authed/estimate.instant.tsx` | Auth | — | L1/L2 instant estimate | Dashboard cards | `L1EstimateForm.test.tsx` | Form unit tests; E2E `NOT_TESTED` |
| `/settings` | `_authed/settings.tsx` | Auth | — | Preferences, delete account | Sidebar | None | **P1 PARTIAL/BROKEN** name not server-persisted |
| `/admin` | `_authed/admin.tsx` | Auth | **Admin** (`RequireAdmin`) | Platform stats, users, projects | Not in main nav | `admin.test.tsx` | `NOT_TESTED` access probes |
| `/marketplace` | `_authed/marketplace.tsx` | Auth | — | Tradeperson directory + quote dialog | Platform nav / deep links | marketplace hooks | `NOT_TESTED` |
| `/deal-copilot` | `_authed/deal-copilot/index.tsx` | Auth | — | Opportunity list | Sidebar | None | `NOT_TESTED` |
| `/deal-copilot/new` | `_authed/deal-copilot/new.tsx` | Auth | — | `DealIntakeForm` + analyze | Copilot CTA | analyze hook tests | `NOT_TESTED` |
| `/deal-copilot/$opportunityId` | `.../$opportunityId.tsx` | Auth | Owner | Opportunity detail | List | None | `NOT_TESTED` |
| `/deal-copilot/$opportunityId/edit` | `.../edit.tsx` | Auth | Owner | Edit opportunity | Detail | update hook tests | `NOT_TESTED` |
| `/trades/new` | `_authed/trades_.new.tsx` | Auth | — | Post job | Nav / trades | None | `NOT_TESTED` |
| `/trades/$jobId/edit` | `_authed/trades_.$jobId_.edit.tsx` | Auth | Owner | Edit job | Job detail | None | `NOT_TESTED` |
| `/trades/profile` | `_authed/trades_.profile.tsx` | Auth | — | Trade profile form | Trades | None | `NOT_TESTED` |

**Layout / shell (not URL routes):** `__root.tsx` (error boundary, analytics, meta), `AppLayout`, `Sidebar`, `Navbar`, `Footer`, `MobileTopBar`, `PlatformNavButtons`, `RequireAuth`, `RequireAdmin`.

---

## 4. Navigation entry points

| Control | Component | Destinations | Status |
| --- | --- | --- | --- |
| Sidebar items | `Sidebar.tsx` | `/dashboard`, `/analyze`, `/studies`, `/deal-copilot`, `/trades`, `/settings` | Structure OK; runtime `NOT_TESTED` |
| Sidebar logout | `Sidebar.tsx` | Sign-out → `/` | Hook unit tests; E2E `NOT_TESTED` |
| Navbar links | `Navbar.tsx` | Dashboard, Deal Copilot, Trades, Post Job, Auth | `NOT_TESTED` |
| Platform nav | `PlatformNavButtons.tsx` | Dashboard, Deal Copilot, Trades, Post Job | `NOT_TESTED` |
| Footer legal | `Footer.tsx` | `/privacy`, `/terms` | `NOT_TESTED` |
| Mobile logo | `MobileTopBar.tsx` | `/` | Unit test exists |
| Landing CTAs | `index.tsx` | Auth, workflow anchors | `NOT_TESTED` |

**Note:** `/admin`, `/estimate/instant`, `/marketplace`, `/gallery` are production routes but **not** primary Sidebar items. Instant estimate and gallery appear via dashboard/public CTAs.

---

## 5. Confirmed defects (code inspection on main)

These are **confirmed causes**, not mere suspicions.

### P0 — Property photo capture on guided study (`/analyze`)

| surfaceId | Defect | Evidence |
| --- | --- | --- |
| `ctrl.analyze.photo.take` | Take Photo / Library disabled when no project | `analyze.tsx` passes `isLoading={!selectedProject \|\| uploadPhotos.isPending}` into `PhotoUploadZone` |
| `ctrl.analyze.photo.camera-input` | Camera input allows `multiple` (should be single + `capture="environment"` only) | `PhotoUploadZone.tsx` lines 128–133: `capture="environment"` **and** `multiple` |
| `ctrl.analyze.project-select` | Free-text + datalist project ID (unresolved free text possible) | `analyze.tsx` `Input` + `datalist` writing raw string to search params |
| `ctrl.analyze.upload-selected` | Upload disabled without project (correct) but no clear project-required message on zone | Silent disable pattern |
| Partial batch / error UX on analyze | Clears selection only on success; limited visible error formatting on route | Code path thinner than dedicated upload page |

**Contrast:** `/projects/$id/upload` camera input is single-file (no `multiple`) with library multi — closer to required semantics.

**Repair branch (unmerged):** draft PR #104 addresses analyze + PhotoUploadZone. Until merged and verified, main remains **BROKEN** for this P0.

### P1 — Settings profile save

| surfaceId | Defect |
| --- | --- |
| `ctrl.settings.save` | “Save changes” only writes **default region** to `localStorage`. Full name is editable in UI but **not** persisted to profile/server. Email is read-only. Toast “Preferences saved” is **misleading** for name. |

### P1 / P2 — Marketplace messaging

| surfaceId | Defect |
| --- | --- |
| `route.trades.banner` | Public `/trades` shows “Trades Marketplace — **coming soon**” while post-job / list / interest flows are implemented — presents unfinished framing on a live surface. |

### P2 — Support incomplete capability

| surfaceId | Defect |
| --- | --- |
| `route.support.export-help` | FAQ states export/screenshot feature “coming soon” for some workflows. |

### Payment / Pro gating

| surfaceId | Notes |
| --- | --- |
| `int.payment.checkout` | Platform payments adapter includes **mock** `createCheckout` returning `mock-checkout`. No production checkout route found. |
| `int.payment.pro-access` | `hasProAccess` is email-domain / `VITE_ENABLE_PRO_FEATURES` flag based — not Stripe entitlement. Export path gates on this. |

### Deal Copilot AI

| surfaceId | Notes |
| --- | --- |
| `int.openai.deal-chat` | Server adapter requires `OPENAI_API_KEY`; without it responses are blocked / placeholder messaging. Status `BLOCKED_CONFIGURATION` or `BLOCKED_EXTERNAL` until staging verified. |

---

## 6. Interactive control inventory (primary production surfaces)

Statuses: majority `NOT_TESTED` pending P0-APP-C/D/E. Only code-confirmed issues use `BROKEN`/`PARTIAL`.

### 6.1 Authentication

| ID | Control | Route | Operation | Status | Sev |
| --- | --- | --- | --- | --- | --- |
| `ctrl.auth.signin-email` | Sign in submit | `/auth` | Supabase password | `NOT_TESTED` | P0 |
| `ctrl.auth.signup-email` | Sign up submit | `/auth` | Supabase signup | `NOT_TESTED` | P0 |
| `ctrl.auth.oauth-google` | Google OAuth | `/auth` | OAuth redirect | `NOT_TESTED` | P0 |
| `ctrl.auth.reset-password` | Reset password | `/auth` | Email reset | `NOT_TESTED` | P1 |
| `ctrl.auth.signout` | Log out | Sidebar | `useSignOut` | `NOT_TESTED` | P0 |
| `ctrl.auth.callback` | Callback complete | `/auth/callback` | Session exchange | `NOT_TESTED` | P0 |

### 6.2 Dashboard

| ID | Control | Status | Sev |
| --- | --- | --- | --- |
| `ctrl.dashboard.onboarding-goal` | Goal select | Unit-tested hydrate/apply | P2 |
| `ctrl.dashboard.dismiss-onboarding` | Dismiss card | `NOT_TESTED` | P3 |
| `ctrl.dashboard.start-study` | Link → `/analyze` | `NOT_TESTED` | P0 |
| `ctrl.dashboard.create-project` | Link → `/projects/new` | `NOT_TESTED` | P0 |
| `ctrl.dashboard.project-card` | Open project | `NOT_TESTED` | P0 |
| `ctrl.dashboard.job-close` | Close job | `NOT_TESTED` | P1 |

### 6.3 Projects

| ID | Control | Status | Sev |
| --- | --- | --- | --- |
| `ctrl.projects.new.submit` | Create project form | `NOT_TESTED` | P0 |
| `ctrl.projects.new.cancel` | Cancel → dashboard | `NOT_TESTED` | P2 |
| `ctrl.projects.detail.tabs` | Stage links upload/analysis/estimate/report | `NOT_TESTED` | P0 |
| `ctrl.projects.detail.publish-gallery` | PublishToGallery | `NOT_TESTED` | P1 |
| `ctrl.projects.stage-set` | Stage mutations | Hook tests partial | P1 |

### 6.4 Photos

| ID | Control | Route | Status | Sev |
| --- | --- | --- | --- | --- |
| `ctrl.analyze.photo.take` | Take Photo | `/analyze` | **BROKEN** | P0 |
| `ctrl.analyze.photo.library` | Upload from Library | `/analyze` | **BROKEN** (same isLoading) | P0 |
| `ctrl.analyze.photo.camera-input` | Hidden camera input | `/analyze` via zone | **BROKEN** (`multiple`) | P0 |
| `ctrl.analyze.upload-selected` | Upload Selected | `/analyze` | **PARTIAL** | P0 |
| `ctrl.upload.camera` | Take Photo | `/projects/$id/upload` | `NOT_TESTED` (semantics OK in code) | P0 |
| `ctrl.upload.library` | Choose Files | `/projects/$id/upload` | `NOT_TESTED` | P0 |
| `ctrl.upload.retry` | Retry failed files | upload page | `NOT_TESTED` | P1 |
| `ctrl.bulk-photo` | BulkPhotoUpload component | shared | `NOT_TESTED` | P1 |

### 6.5 Feasibility / analyze orchestrator

| ID | Control | Status | Sev |
| --- | --- | --- | --- |
| `ctrl.analyze.run-full` | Run full analysis | `NOT_TESTED` (disabled without project/photos) | P0 |
| `ctrl.analyze.stage-select` | Stage checklist clicks | `NOT_TESTED` | P0 |
| `ctrl.analyze.retry-stage` | Retry from last successful | `NOT_TESTED` | P0 |
| `ctrl.analyze.continue-stage` | Continue current stage | `NOT_TESTED` | P0 |
| `ctrl.analyze.queue-export` | Queue export | `NOT_TESTED` | P1 |
| `ctrl.analyze.export-report` | Export report | Pro-gated path | `NOT_TESTED` | P1 |

### 6.6 Estimate / ROI / report

| ID | Control | Status | Sev |
| --- | --- | --- | --- |
| `ctrl.estimate.instant.l1` | Instant L1 form | Unit tests | P0 |
| `ctrl.estimate.project.generate` | Generate / save estimate | `NOT_TESTED` | P0 |
| `ctrl.estimate.region-condition` | Selects | `NOT_TESTED` | P1 |
| `ctrl.estimate.roi-metrics` | Live ROI display | `NOT_TESTED` | P0 |
| `ctrl.report.export-pdf` | PDF export | `NOT_TESTED` | P0 |
| `ctrl.report.open-study` | Study link | `NOT_TESTED` | P1 |

### 6.7 Studies / sharing

| ID | Control | Status | Sev |
| --- | --- | --- | --- |
| `ctrl.studies.list.open` | Open study | `NOT_TESTED` | P0 |
| `ctrl.studies.share.create` | Create share link | `NOT_TESTED` | P1 |
| `ctrl.studies.share.revoke` | Revoke share link | `NOT_TESTED` | P1 |

### 6.8 Deal Copilot

| ID | Control | Status | Sev |
| --- | --- | --- | --- |
| `ctrl.deal.new.analyze` | Intake submit | `NOT_TESTED` | P1 |
| `ctrl.deal.list.open` | Open opportunity | `NOT_TESTED` | P1 |
| `ctrl.deal.edit.save` | Save edit | `NOT_TESTED` | P1 |
| `ctrl.deal.chat.send` | Chat send (if mounted) | `NOT_TESTED` / may be `BLOCKED_EXTERNAL` | P1 |

### 6.9 Trades / marketplace

| ID | Control | Status | Sev |
| --- | --- | --- | --- |
| `ctrl.trades.filter-category` | Category filters | `NOT_TESTED` | P2 |
| `ctrl.trades.post-job` | → `/trades/new` | `NOT_TESTED` | P1 |
| `ctrl.trades.job.interest` | Submit interest | `NOT_TESTED` | P1 |
| `ctrl.trades.job.accept-reject` | Owner interest actions | `NOT_TESTED` | P1 |
| `ctrl.trades.profile.save` | Trade profile form | `NOT_TESTED` | P1 |
| `ctrl.marketplace.quote` | Quote request dialog | `NOT_TESTED` | P1 |

### 6.10 Gallery / public

| ID | Control | Status | Sev |
| --- | --- | --- | --- |
| `ctrl.gallery.list.open` | Open slug | `NOT_TESTED` | P1 |
| `ctrl.gallery.contact` | Contact anchor | `NOT_TESTED` | P2 |
| `ctrl.gallery.investor-lead` | Lead submit serverFn | `NOT_TESTED` | P1 |

### 6.11 Settings / admin

| ID | Control | Status | Sev |
| --- | --- | --- | --- |
| `ctrl.settings.save` | Save preferences | **BROKEN** (name fake success) | P1 |
| `ctrl.settings.delete-account` | Delete + confirm | `NOT_TESTED` | P1 |
| `ctrl.admin.stats` | View metrics | `NOT_TESTED` | P1 |
| `ctrl.admin.users` | User list | `NOT_TESTED` | P1 |
| `ctrl.admin.gate` | Non-admin denied | `NOT_TESTED` | P0 |

### 6.12 Global / a11y shell

| ID | Control | Status | Sev |
| --- | --- | --- | --- |
| `ctrl.theme.toggle` | ThemeToggle | `NOT_TESTED` | P3 |
| `ctrl.root.error-reset` | Error boundary reset | `NOT_TESTED` | P2 |
| `ctrl.mobile.menu` | Hamburger nav | `NOT_TESTED` | P2 |

---

## 7. Backend and integration inventory

### 7.1 Server functions (TanStack `createServerFn`)

| Module | Functions (representative) | Auth | Persistence |
| --- | --- | --- | --- |
| `serverFns/auth.ts` | `getCurrentUserServerFn`, `deleteAccountServerFn` | Session | profiles / auth |
| `serverFns/projects.ts` | `createProjectServerFn` | Session + ownership | projects |
| `serverFns/dealCopilot.ts` | save/delete opportunity | Session | deal opportunities |
| `serverFns/dealChat.ts` | create/list threads, list/send messages | Session | deal chat |
| `serverFns/dealAnalysis.ts` | `analyzeDealServerFn` | Session | AI + store |
| `features/ai-upload/.../serverFns.ts` | `runPhotoAnalysisServerFn`, provider variant | Session | room_analyses |
| `features/ai-design/.../serverFns.ts` | redesign concepts, scope analysis | Session | AI outputs |
| `features/estimate/.../serverFns.ts` | generate estimate, authority save | Session | estimates |
| `core/gallery/serverFns.ts` | `submitInvestorLead` | Public/lead | leads |

### 7.2 Client-side Supabase writes (representative)

| Area | Module | Tables / storage |
| --- | --- | --- |
| Photos | `lib/photos-write.ts` | Storage `project-photos` + photo metadata |
| Estimates | estimate repository | project estimates |
| Stages | `projectStageRepository` | project stage flags |
| Feasibility | feasibility repository | studies / checkpoints |
| Export | export repository + PDF | export records / files |
| Share links | `shareLink.repository` | `share_links` |
| Gallery | gallery repository | gallery + storage |
| Trades | marketplace feature | jobs / interests / profiles |
| ROI | engine (client compute) + estimate page save path | financial fields |

### 7.3 External integrations

| Integration | Env vars (names only) | Production surface | Status |
| --- | --- | --- | --- |
| Supabase Auth/DB/Storage | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | All authenticated data | Config `UNVERIFIED` this phase |
| OpenAI | `OPENAI_API_KEY` | Vision, deal chat, estimates | `NOT_TESTED` / may `BLOCKED_CONFIGURATION` |
| HuggingFace | `HUGGINGFACE_API_KEY`, `HUGGINGFACE_ENDPOINT_URL`, model envs | Vision fallback | `NOT_TESTED` |
| Resend | `RESEND_API_KEY` | Email (server) | `NOT_TESTED` |
| PostHog | `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN`, host | Analytics | Optional `NOT_TESTED` |
| Sentry | `VITE_SENTRY_DSN` | Error reporting | Optional `NOT_TESTED` |
| Payments | mock provider + `VITE_ENABLE_PRO_FEATURES` | Pro export gate | **Mock / domain gate** — not full Stripe journey |
| Apple client meta | `VITE_APPLE_CLIENT_ID` | Meta tag only | `NOT_TESTED` |
| Public URL | `VITE_PUBLIC_URL` | Absolute URLs / SEO | `NOT_TESTED` |

---

## 8. Core customer journey map (priority for P0-APP-C)

| Step | Route / control | Inventory status | Blocker |
| --- | --- | --- | --- |
| Sign up | `/auth` | `NOT_TESTED` | Runtime E2E |
| Sign in | `/auth` | `NOT_TESTED` | Runtime E2E |
| Create project | `/projects/new` | `NOT_TESTED` | Runtime E2E |
| Edit project | project detail | `NOT_TESTED` | Confirm edit surface |
| Capture/upload photos | `/analyze`, `/projects/$id/upload` | **BROKEN** on analyze | P0 photo defects; PR #104 unmerged |
| AI analysis | analysis + orchestrator | `NOT_TESTED` | OpenAI config |
| Scope | `/projects/$id/scope` | `NOT_TESTED` | |
| Redesign / skip | feasibility stages | `NOT_TESTED` | |
| Estimate | project + instant | Partial unit | Runtime |
| ROI | estimate page metrics | `NOT_TESTED` | |
| Export | report / feasibility export | Pro gate | |
| Reopen study | `/studies/$id` | `NOT_TESTED` | |
| Download/share | share links + PDF | `NOT_TESTED` | |

---

## 9. Status totals (P0-APP-A close)

Counts are for surfaces recorded in the JSON register (routes + primary controls + integrations). They intentionally over-represent `NOT_TESTED`.

| Status | Count (approx.) | Notes |
| --- | --- | --- |
| WORKING | 0 | None promoted without runtime evidence |
| BROKEN | 7 | Analyze photo path + free-text project + settings name save |
| PARTIAL | 9 | Auth unit coverage, trades banner, upload page code-OK, support, etc. |
| INACCESSIBLE | 0 | Admin gate untested (not yet proven inaccessible incorrectly) |
| BLOCKED_CONFIGURATION | 1 | OpenAI/deal chat without key (env-dependent) |
| BLOCKED_EXTERNAL | 1 | Payment real checkout not production-wired |
| INTENTIONALLY_HIDDEN | 1 | Admin not in primary nav |
| NOT_TESTED | 66 | Expected until C–E phases |

**Total surfaces in JSON:** 85 (routes + primary controls + backend + integrations).

**P0 open issues on main:** analyze photo capture/upload path (and free-text project selector as contributing factor).

---

## 10. Automated test coverage map (existing)

| Area | Evidence |
| --- | --- |
| Auth presentation | `AuthExperience.test.tsx`, password/OAuth/sign-out/callback hooks |
| Dashboard | `dashboard.test.tsx` (onboarding goal only) |
| Admin | `admin.test.tsx` + admin metrics hooks |
| Photos | format/classify error, usePhotos, invalidation hooks — **no PhotoUploadZone test on main** |
| Estimate | L1 form, L2 fields, save/apply hooks |
| Feasibility | `useProjectCatalog.test.ts` |
| Marketplace | quote, messages, favorites hooks |
| Deal | analyze/update opportunity hooks |
| Export | pitch deck hook |
| Invariants | `pnpm test:invariants` (auth-env, server-only boundary, etc.) |
| UI suite | `pnpm test:ui` (vitest) |

**Gap:** No every-button audit harness yet (scheduled for programme §8). No full E2E signup→export journey on CI evidence in this inventory.

---

## 11. Recommended repair sequence (after inventory acceptance)

1. **Merge path for photos:** complete independent verification of PR #104 (P0-PHOTO-1V) or re-land equivalent on main — unblocks core journey photos.
2. **P0-APP-B:** env + local Supabase + integration readiness (no secrets in git).
3. **P0-APP-C branches:** auth, projects, photos (if still open), guided feasibility, estimate/ROI/export.
4. **P0-APP-D:** deal-copilot, trades, gallery, settings (name persistence), payments gating honesty, admin probes.
5. **P0-APP-E / Z:** regression, staging deploy, independent gate.

Do **not** resume 4C2E / catalogue-publication / D1 until this programme is independently closed.

---

## 12. Honesty statement

This document is **audit evidence for P0-APP-A**, not a claim that the application is operational.

- No production-visible control is marked `WORKING` based solely on code review.
- Confirmed defects are listed with file-level evidence.
- Outstanding draft PR #104 is **not** treated as merged behaviour on main.
- Environment values were **not** printed; classification for live secrets is deferred to P0-APP-B.

---

## 13. Validation of this register

```bash
node scripts/validate-functional-surface-register.mjs
```

Expect exit 0 when JSON schema and required fields are present.
