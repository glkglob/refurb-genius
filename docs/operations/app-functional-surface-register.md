# Application Functional Surface Register

**Programme:** P0-APP — Full Application Operational Readiness
**Phase:** P0-APP-AR2 — Functional Surface Inventory Repair and Completeness Enforcement
**Branch:** `audit/p0-app-operational-baseline`
**Baseline main SHA:** `b2041176bfbcc9aea83cffd69da8161884638deb`
**Inventory date:** 2026-08-04
**Canonical data:** JSON (this Markdown is generated from JSON)
**Method:** Static inspection + `routeTree.gen.ts` reconciliation. Perfect AST discovery is **not** claimed.

Machine-readable twin: [`app-functional-surface-register.json`](./app-functional-surface-register.json).
Exceptions allowlist: [`app-functional-surface-exceptions.json`](./app-functional-surface-exceptions.json).

> No surface is marked `WORKING`. Runtime verification is incomplete.

## Counts

| Metric | Count |
| --- | ---: |
| Routes | 34 |
| Controls | 182 |
| Backend operations | 48 |
| External integrations | 15 |
| **Total surfaces** | **279** |

### Status totals

| Status | Count |
| --- | ---: |
| WORKING | 0 |
| BROKEN | 7 |
| PARTIAL | 10 |
| INACCESSIBLE | 0 |
| BLOCKED_CONFIGURATION | 1 |
| BLOCKED_EXTERNAL | 0 |
| INTENTIONALLY_HIDDEN | 1 |
| NOT_TESTED | 260 |

## Routes

| surfaceId | route | authClass | sourcePath | status | severity |
| --- | --- | --- | --- | --- | --- |
| `route.public.home` | `/` | public | `src/routes/index.tsx` | NOT_TESTED | P1 |
| `route.auth` | `/auth` | public | `src/routes/auth.tsx` | PARTIAL | P0 |
| `route.auth.callback` | `/auth/callback` | public | `src/routes/auth_.callback.tsx` | NOT_TESTED | P0 |
| `route.oauth.consent` | `/oauth/consent` | public | `src/routes/oauth.consent.tsx` | NOT_TESTED | P2 |
| `route.privacy` | `/privacy` | public | `src/routes/privacy.tsx` | NOT_TESTED | P2 |
| `route.terms` | `/terms` | public | `src/routes/terms.tsx` | NOT_TESTED | P2 |
| `route.support` | `/support` | public | `src/routes/support.tsx` | PARTIAL | P2 |
| `route.gallery.list` | `/gallery` | public | `src/routes/gallery.tsx` | NOT_TESTED | P1 |
| `route.gallery.detail` | `/gallery/$slug` | public | `src/routes/gallery.$slug.tsx` | NOT_TESTED | P1 |
| `route.trades.public` | `/trades` | public | `src/routes/trades.tsx` | PARTIAL | P1 |
| `route.trades.job-detail` | `/trades/$jobId` | public | `src/routes/trades_.$jobId.tsx` | NOT_TESTED | P1 |
| `route.dashboard` | `/dashboard` | authenticated | `src/routes/_authed/dashboard.tsx` | NOT_TESTED | P0 |
| `route.analyze` | `/analyze` | authenticated | `src/routes/_authed/analyze.tsx` | BROKEN | P0 |
| `route.studies.list` | `/studies` | authenticated | `src/routes/_authed/studies.tsx` | NOT_TESTED | P0 |
| `route.studies.detail` | `/studies/$id` | authenticated | `src/routes/_authed/studies.$id.tsx` | NOT_TESTED | P0 |
| `route.projects.new` | `/projects/new` | authenticated | `src/routes/_authed/projects.new.tsx` | NOT_TESTED | P0 |
| `route.projects.detail` | `/projects/$id` | authenticated | `src/routes/_authed/projects.$id.index.tsx` | NOT_TESTED | P0 |
| `route.projects.upload` | `/projects/$id/upload` | authenticated | `src/routes/_authed/projects.$id.upload.tsx` | PARTIAL | P0 |
| `route.projects.analysis` | `/projects/$id/analysis` | authenticated | `src/routes/_authed/projects.$id.analysis.tsx` | NOT_TESTED | P0 |
| `route.projects.scope` | `/projects/$id/scope` | authenticated | `src/routes/_authed/projects.$id.scope.tsx` | NOT_TESTED | P0 |
| `route.projects.estimate` | `/projects/$id/estimate` | authenticated | `src/routes/_authed/projects.$id.estimate.tsx` | NOT_TESTED | P0 |
| `route.projects.report` | `/projects/$id/report` | authenticated | `src/routes/_authed/projects.$id.report.tsx` | NOT_TESTED | P0 |
| `route.estimate.instant` | `/estimate/instant` | authenticated | `src/routes/_authed/estimate.instant.tsx` | PARTIAL | P0 |
| `route.settings` | `/settings` | authenticated | `src/routes/_authed/settings.tsx` | BROKEN | P1 |
| `route.admin` | `/admin` | admin | `src/routes/_authed/admin.tsx` | NOT_TESTED | P1 |
| `route.marketplace` | `/marketplace` | authenticated | `src/routes/_authed/marketplace.tsx` | NOT_TESTED | P1 |
| `route.deal-copilot.index` | `/deal-copilot` | authenticated | `src/routes/_authed/deal-copilot/index.tsx` | NOT_TESTED | P1 |
| `route.deal-copilot.new` | `/deal-copilot/new` | authenticated | `src/routes/_authed/deal-copilot/new.tsx` | NOT_TESTED | P1 |
| `route.deal-copilot.detail` | `/deal-copilot/$opportunityId` | authenticated | `src/routes/_authed/deal-copilot/$opportunityId.tsx` | NOT_TESTED | P1 |
| `route.deal-copilot.edit` | `/deal-copilot/$opportunityId/edit` | authenticated | `src/routes/_authed/deal-copilot/$opportunityId.edit.tsx` | NOT_TESTED | P1 |
| `route.trades.new` | `/trades/new` | authenticated | `src/routes/_authed/trades_.new.tsx` | NOT_TESTED | P1 |
| `route.trades.edit` | `/trades/$jobId/edit` | authenticated | `src/routes/_authed/trades_.$jobId_.edit.tsx` | NOT_TESTED | P1 |
| `route.trades.profile` | `/trades/profile` | authenticated | `src/routes/_authed/trades_.profile.tsx` | NOT_TESTED | P1 |
| `route.authed.layout-gate` | `/_authed` | authenticated | `src/routes/_authed.tsx` | NOT_TESTED | P0 |

## Controls (by area)

### administration

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.admin.gate` | RequireAdmin access gate | `/admin` | NOT_TESTED | P0 | — |
| `ctrl.admin.stats-view` | Platform stats cards | `/admin` | NOT_TESTED | P1 | — |
| `ctrl.admin.projects-view` | Recent projects list | `/admin` | NOT_TESTED | P1 | — |
| `ctrl.admin.users-view` | Users list | `/admin` | NOT_TESTED | P1 | — |
| `ctrl.admin.ai-metrics` | AIMetricsDashboard | `/admin` | NOT_TESTED | P2 | — |

### authentication

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.auth.mode.signin` | Mode switch: Sign in | `/auth` | NOT_TESTED | P0 | — |
| `ctrl.auth.mode.signup` | Mode switch: Sign up | `/auth` | NOT_TESTED | P0 | — |
| `ctrl.auth.header-mode-toggle` | Header Sign in/Sign up toggle | `/auth` | NOT_TESTED | P2 | — |
| `ctrl.auth.signin-submit` | Sign in form submit | `/auth` | NOT_TESTED | P0 | — |
| `ctrl.auth.signup-submit` | Sign up form submit | `/auth` | NOT_TESTED | P0 | — |
| `ctrl.auth.terms-checkbox` | Terms consent checkbox | `/auth` | NOT_TESTED | P1 | — |
| `ctrl.auth.terms-link` | Terms link | `/auth` | NOT_TESTED | P2 | — |
| `ctrl.auth.privacy-link` | Privacy link | `/auth` | NOT_TESTED | P2 | — |
| `ctrl.auth.forgot-password` | Forgot password request | `/auth` | NOT_TESTED | P1 | — |
| `ctrl.auth.magic-link` | Continue with magic link | `/auth` | PARTIAL | P0 | — |
| `ctrl.auth.reset-submit` | Password reset mode submit | `/auth` | NOT_TESTED | P1 | — |
| `ctrl.auth.show-password` | Toggle password visibility | `/auth` | NOT_TESTED | P3 | — |
| `ctrl.auth.show-confirm-password` | Toggle confirm password visibility | `/auth` | NOT_TESTED | P3 | — |
| `ctrl.auth.oauth.google` | Continue with Google | `/auth` | NOT_TESTED | P0 | — |
| `ctrl.auth.oauth.apple` | Continue with Apple | `/auth` | NOT_TESTED | P0 | — |
| `ctrl.auth.oauth.github` | Continue with GitHub | `/auth` | NOT_TESTED | P0 | — |
| `ctrl.auth.callback.recovery` | Callback error recovery link to /auth | `/auth/callback` | NOT_TESTED | P1 | — |
| `ctrl.auth.signout` | Sidebar logout | `*` | NOT_TESTED | P0 | — |
| `ctrl.oauth.consent.signin` | Consent page Sign in | `/oauth/consent` | NOT_TESTED | P2 | — |
| `ctrl.oauth.consent.home` | Consent page Home | `/oauth/consent` | NOT_TESTED | P3 | — |

### dashboard

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.dashboard.onboarding-goal` | Onboarding goal select | `/dashboard` | PARTIAL | P2 | e2e-onboarding |
| `ctrl.dashboard.onboarding-dismiss` | Dismiss onboarding card | `/dashboard` | NOT_TESTED | P3 | — |
| `ctrl.dashboard.start-study` | Start first study | `/dashboard` | NOT_TESTED | P0 | — |
| `ctrl.dashboard.create-project` | Create project CTA | `/dashboard` | NOT_TESTED | P0 | — |
| `ctrl.dashboard.empty-create-project` | Empty projects Create project | `/dashboard` | NOT_TESTED | P0 | — |
| `ctrl.dashboard.quick.instant-estimate` | Quick action Instant Estimate | `/dashboard` | NOT_TESTED | P0 | — |
| `ctrl.dashboard.quick.post-job` | Quick action Post a Trades Job | `/dashboard` | NOT_TESTED | P1 | — |
| `ctrl.dashboard.quick.studies` | Quick action Saved Studies | `/dashboard` | NOT_TESTED | P0 | — |
| `ctrl.dashboard.quick.create-project` | Quick action Create Project | `/dashboard` | NOT_TESTED | P0 | — |
| `ctrl.dashboard.section.post-job` | My trades + Post new job | `/dashboard` | NOT_TESTED | P1 | — |
| `ctrl.dashboard.job.view` | Job row View | `/dashboard` | NOT_TESTED | P1 | — |
| `ctrl.dashboard.job.edit` | Job row Edit | `/dashboard` | NOT_TESTED | P1 | — |
| `ctrl.dashboard.job.close` | Job row Close job | `/dashboard` | NOT_TESTED | P1 | — |
| `ctrl.dashboard.interest.view-job` | Interest View job | `/dashboard` | NOT_TESTED | P2 | — |
| `ctrl.dashboard.project.open` | Project card open | `/dashboard` | NOT_TESTED | P0 | — |
| `ctrl.dashboard.roi-cta` | Run Full ROI Analysis card | `/dashboard` | NOT_TESTED | P1 | — |

### deal-copilot

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.deal.list.new` | New deal analysis | `/deal-copilot` | NOT_TESTED | P1 | — |
| `ctrl.deal.list.open` | Open opportunity | `/deal-copilot` | NOT_TESTED | P1 | — |
| `ctrl.deal.new.submit` | DealIntakeForm submit/analyze | `/deal-copilot/new` | NOT_TESTED | P1 | — |
| `ctrl.deal.detail.edit` | Edit opportunity | `/deal-copilot/$opportunityId` | NOT_TESTED | P1 | — |
| `ctrl.deal.detail.back` | Back to list | `/deal-copilot/$opportunityId` | NOT_TESTED | P2 | — |
| `ctrl.deal.detail.listing-url` | Open listing URL | `/deal-copilot/$opportunityId` | NOT_TESTED | P2 | — |
| `ctrl.deal.chat.new-thread` | Create chat thread | `/deal-copilot/$opportunityId` | NOT_TESTED | P1 | — |
| `ctrl.deal.chat.send` | Send chat message | `/deal-copilot/$opportunityId` | NOT_TESTED | P1 | — |
| `ctrl.deal.chat.mic` | Mic toggle (speech) | `/deal-copilot/$opportunityId` | NOT_TESTED | P3 | — |
| `ctrl.deal.edit.submit` | Save opportunity edit | `/deal-copilot/$opportunityId/edit` | NOT_TESTED | P1 | — |
| `ctrl.deal.edit.status` | Status select | `/deal-copilot/$opportunityId/edit` | NOT_TESTED | P2 | — |
| `ctrl.deal.edit.cancel` | Back/cancel to detail | `/deal-copilot/$opportunityId/edit` | NOT_TESTED | P2 | — |
| `ctrl.deal.feedback.send` | DealCopilotFeedback send | `/deal-copilot/*` | NOT_TESTED | P3 | — |

### estimate

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.estimate.region` | Region select | `/projects/$id/estimate` | NOT_TESTED | P1 | — |
| `ctrl.estimate.condition` | Condition select | `/projects/$id/estimate` | NOT_TESTED | P1 | — |
| `ctrl.estimate.category-checkbox` | Category checkboxes | `/projects/$id/estimate` | NOT_TESTED | P1 | — |
| `ctrl.estimate.generate-save` | Generate/save estimate actions | `/projects/$id/estimate` | NOT_TESTED | P0 | — |
| `ctrl.estimate.continue-report` | Continue to report | `/projects/$id/estimate` | NOT_TESTED | P0 | — |
| `ctrl.estimate.instant.l1-submit` | L1EstimateForm submit | `/estimate/instant` | PARTIAL | P0 | e2e-instant-estimate |
| `ctrl.estimate.instant.l2-fields` | L2 detail fields | `/estimate/instant` | NOT_TESTED | P1 | — |

### export

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.analyze.queue-export` | Queue Investor Export | `/analyze` | NOT_TESTED | P1 | — |
| `ctrl.analyze.export-report` | Export feasibility report | `/analyze` | NOT_TESTED | P1 | — |
| `ctrl.report.print` | Print report | `/projects/$id/report` | NOT_TESTED | P2 | — |
| `ctrl.report.export-pdf` | Export PDF | `/projects/$id/report` | NOT_TESTED | P0 | — |
| `ctrl.report.back-project` | Back to project | `/projects/$id/report` | NOT_TESTED | P2 | — |

### feasibility

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.analyze.project-select` | Project free-text + datalist | `/analyze` | BROKEN | P0 | free-text-project-id |
| `ctrl.analyze.run-full` | Run Full Analysis | `/analyze` | NOT_TESTED | P0 | — |
| `ctrl.analyze.stage.click` | Guided stage checklist item click | `/analyze` | NOT_TESTED | P0 | — |
| `ctrl.analyze.retry-stage` | Retry stage | `/analyze` | NOT_TESTED | P0 | — |
| `ctrl.analyze.continue-stage` | Continue from last success | `/analyze` | NOT_TESTED | P0 | — |
| `ctrl.analysis.retry-weak` | Retry weak analyses | `/projects/$id/analysis` | NOT_TESTED | P1 | — |
| `ctrl.analysis.continue-estimate` | Continue to estimate | `/projects/$id/analysis` | NOT_TESTED | P0 | — |
| `ctrl.scope.generate` | Generate/save scope analysis | `/projects/$id/scope` | NOT_TESTED | P0 | — |
| `ctrl.scope.continue-estimate` | Continue to estimate from scope | `/projects/$id/scope` | NOT_TESTED | P0 | — |

### gallery

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.projects.detail.publish-file` | PublishToGallery file input | `/projects/$id` | NOT_TESTED | P2 | — |
| `ctrl.gallery.list.open` | Open gallery project | `/gallery` | NOT_TESTED | P1 | — |
| `ctrl.gallery.list.filter` | Gallery filter/control buttons | `/gallery` | NOT_TESTED | P2 | — |
| `ctrl.gallery.detail.back` | Back to gallery | `/gallery/$slug` | NOT_TESTED | P2 | — |
| `ctrl.gallery.detail.contact` | Contact Owner anchor | `/gallery/$slug` | NOT_TESTED | P2 | — |
| `ctrl.gallery.detail.lead-submit` | Investor lead submit | `/gallery/$slug` | NOT_TESTED | P1 | — |

### marketplace

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.marketplace.search` | Search tradepersons | `/marketplace` | NOT_TESTED | P2 | — |
| `ctrl.marketplace.filter-specialty` | Specialty filter | `/marketplace` | NOT_TESTED | P2 | — |
| `ctrl.marketplace.filter-postcode` | Postcode filter | `/marketplace` | NOT_TESTED | P2 | — |
| `ctrl.marketplace.favorite` | Toggle favorite tradeperson | `/marketplace` | NOT_TESTED | P2 | — |
| `ctrl.marketplace.quote-open` | Open quote request dialog | `/marketplace` | NOT_TESTED | P1 | — |
| `ctrl.marketplace.quote-submit` | Submit quote request | `/marketplace` | NOT_TESTED | P1 | — |
| `ctrl.marketplace.quote-cancel` | Cancel quote dialog | `/marketplace` | NOT_TESTED | P2 | — |
| `ctrl.marketplace.message-send` | MessagingInbox send | `/marketplace` | NOT_TESTED | P1 | — |

### navigation

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.nav.sidebar.dashboard` | Sidebar → Dashboard | `*` | NOT_TESTED | P0 | — |
| `ctrl.nav.sidebar.analyze` | Sidebar → New Study | `*` | NOT_TESTED | P0 | — |
| `ctrl.nav.sidebar.studies` | Sidebar → Studies | `*` | NOT_TESTED | P0 | — |
| `ctrl.nav.sidebar.deal-copilot` | Sidebar → Deal Copilot | `*` | NOT_TESTED | P1 | — |
| `ctrl.nav.sidebar.trades` | Sidebar → Trades | `*` | NOT_TESTED | P1 | — |
| `ctrl.nav.sidebar.settings` | Sidebar → Settings | `*` | NOT_TESTED | P1 | — |
| `ctrl.nav.sidebar.admin-absent` | Admin link in primary Sidebar | `*` | INTENTIONALLY_HIDDEN | P2 | — |
| `ctrl.nav.navbar.dashboard` | Navbar Dashboard | `public` | NOT_TESTED | P1 | — |
| `ctrl.nav.navbar.deal-copilot` | Navbar Deal Copilot | `public` | NOT_TESTED | P1 | — |
| `ctrl.nav.navbar.trades` | Navbar Trades | `public` | NOT_TESTED | P1 | — |
| `ctrl.nav.navbar.post-job` | Navbar Post Job | `public` | NOT_TESTED | P1 | — |
| `ctrl.nav.navbar.signin` | Navbar Sign in | `public` | NOT_TESTED | P0 | — |
| `ctrl.nav.navbar.signup` | Navbar Get started free | `public` | NOT_TESTED | P0 | — |
| `ctrl.nav.navbar.mobile-menu` | Mobile hamburger toggle | `public` | NOT_TESTED | P2 | — |
| `ctrl.nav.footer.privacy` | Footer Data Privacy | `*` | NOT_TESTED | P2 | — |
| `ctrl.nav.footer.terms` | Footer Terms | `*` | NOT_TESTED | P2 | — |
| `ctrl.nav.mobile-topbar.home` | Mobile top bar logo home | `*` | NOT_TESTED | P2 | — |
| `ctrl.nav.theme-toggle` | ThemeToggle | `*` | NOT_TESTED | P3 | — |
| `ctrl.nav.platform.dashboard` | PlatformNav Dashboard | `*` | NOT_TESTED | P2 | — |
| `ctrl.nav.platform.deal-copilot` | PlatformNav Deal Copilot | `*` | NOT_TESTED | P2 | — |
| `ctrl.nav.platform.trades` | PlatformNav Trades | `*` | NOT_TESTED | P2 | — |
| `ctrl.nav.platform.post-job` | PlatformNav Post Job | `*` | NOT_TESTED | P2 | — |

### photos

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.analyze.photo.take` | Take Photo | `/analyze` | BROKEN | P0 | isLoading-gated-on-project |
| `ctrl.analyze.photo.library` | Upload from Library | `/analyze` | BROKEN | P0 | isLoading-gated-on-project |
| `ctrl.analyze.photo.camera-input` | Hidden camera input | `/analyze` | BROKEN | P0 | camera-multiple-attribute |
| `ctrl.analyze.photo.library-input` | Hidden library input | `/analyze` | NOT_TESTED | P0 | — |
| `ctrl.analyze.photo.remove` | Remove selected photo | `/analyze` | NOT_TESTED | P1 | — |
| `ctrl.analyze.photo.clear` | Clear selection | `/analyze` | NOT_TESTED | P1 | — |
| `ctrl.analyze.upload-selected` | Upload Selected | `/analyze` | PARTIAL | P0 | analyze-upload-ux |
| `ctrl.upload.camera` | Take Photo | `/projects/$id/upload` | NOT_TESTED | P0 | — |
| `ctrl.upload.library` | Choose Files | `/projects/$id/upload` | NOT_TESTED | P0 | — |
| `ctrl.upload.camera-input` | Hidden camera input | `/projects/$id/upload` | NOT_TESTED | P0 | — |
| `ctrl.upload.library-input` | Hidden library input | `/projects/$id/upload` | NOT_TESTED | P0 | — |
| `ctrl.upload.remove-photo` | Remove uploaded photo | `/projects/$id/upload` | NOT_TESTED | P1 | — |
| `ctrl.upload.retry` | Retry failed upload items | `/projects/$id/upload` | NOT_TESTED | P1 | — |
| `ctrl.upload.run-analysis` | Run AI Analysis | `/projects/$id/upload` | NOT_TESTED | P0 | — |

### projects

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.projects.new.submit` | Create & continue | `/projects/new` | NOT_TESTED | P0 | — |
| `ctrl.projects.new.cancel` | Cancel | `/projects/new` | NOT_TESTED | P2 | — |
| `ctrl.projects.new.region` | Region select | `/projects/new` | NOT_TESTED | P2 | — |
| `ctrl.projects.new.property-type` | Property type select | `/projects/new` | NOT_TESTED | P2 | — |
| `ctrl.projects.detail.tab.overview` | Tab overview | `/projects/$id` | NOT_TESTED | P1 | — |
| `ctrl.projects.detail.pipeline.upload` | Pipeline → Upload | `/projects/$id` | NOT_TESTED | P0 | — |
| `ctrl.projects.detail.pipeline.analysis` | Pipeline → Analysis | `/projects/$id` | NOT_TESTED | P0 | — |
| `ctrl.projects.detail.pipeline.estimate` | Pipeline → Estimate | `/projects/$id` | NOT_TESTED | P0 | — |
| `ctrl.projects.detail.pipeline.report` | Pipeline → Report | `/projects/$id` | NOT_TESTED | P0 | — |
| `ctrl.projects.detail.saved-studies` | Saved studies link | `/projects/$id` | NOT_TESTED | P1 | — |
| `ctrl.projects.detail.bulk-upload` | BulkPhotoUpload zone | `/projects/$id` | NOT_TESTED | P1 | — |
| `ctrl.projects.detail.publish-gallery` | PublishToGallery open/submit | `/projects/$id` | NOT_TESTED | P1 | — |

### public

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.public.home.cta-auth` | Landing primary auth CTA | `/` | NOT_TESTED | P0 | — |
| `ctrl.public.home.workflow-anchor` | Workflow section anchor | `/` | NOT_TESTED | P3 | — |
| `ctrl.public.support.mailto` | support@ mailto | `/support` | NOT_TESTED | P2 | — |
| `ctrl.public.privacy.mailto` | privacy support mailto | `/privacy` | NOT_TESTED | P3 | — |
| `ctrl.root.error-reset` | Root error boundary reset | `*` | NOT_TESTED | P2 | — |
| `ctrl.root.error-home` | Root error boundary home link | `*` | NOT_TESTED | P2 | — |

### roi

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.estimate.roi-display` | Live ROI metrics display | `/projects/$id/estimate` | NOT_TESTED | P0 | — |

### settings

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.settings.save` | Save changes | `/settings` | BROKEN | P1 | missing-profile-mutation |
| `ctrl.settings.region` | Default region select | `/settings` | NOT_TESTED | P2 | — |
| `ctrl.settings.link.privacy` | Privacy Policy link | `/settings` | NOT_TESTED | P3 | — |
| `ctrl.settings.link.terms` | Terms link | `/settings` | NOT_TESTED | P3 | — |
| `ctrl.settings.link.support` | Contact support link | `/settings` | NOT_TESTED | P3 | — |
| `ctrl.settings.delete-open` | Delete Account open dialog | `/settings` | NOT_TESTED | P1 | — |
| `ctrl.settings.delete-confirm` | Delete Account confirm | `/settings` | NOT_TESTED | P1 | — |
| `ctrl.settings.delete-cancel` | Delete Account cancel | `/settings` | NOT_TESTED | P2 | — |

### sharing

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.studies.detail.share-create` | Create share link | `/studies/$id` | NOT_TESTED | P1 | — |
| `ctrl.studies.detail.share-revoke` | Revoke share link | `/studies/$id` | NOT_TESTED | P1 | — |
| `ctrl.studies.detail.share-open` | Open share link external | `/studies/$id` | NOT_TESTED | P2 | — |

### studies

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.analyze.open-study` | Open study dashboard link | `/analyze` | NOT_TESTED | P1 | — |
| `ctrl.studies.filter-project` | Project filter input/datalist | `/studies` | NOT_TESTED | P1 | — |
| `ctrl.studies.open` | Open study | `/studies` | NOT_TESTED | P0 | — |
| `ctrl.studies.list.duplicate` | Duplicate (per-card) | `/studies` | NOT_TESTED | P1 | — |
| `ctrl.studies.list.export` | Export (per-card) | `/studies` | NOT_TESTED | P0 | — |
| `ctrl.studies.list.share` | Share (per-card) | `/studies` | NOT_TESTED | P0 | — |
| `ctrl.studies.list.archive` | Delete (archive per-card) | `/studies` | NOT_TESTED | P0 | — |
| `ctrl.studies.detail.queue-export` | Queue export | `/studies/$id` | NOT_TESTED | P1 | — |
| `ctrl.studies.detail.export-pdf` | Export PDF | `/studies/$id` | NOT_TESTED | P0 | — |
| `ctrl.studies.detail.back` | Back to studies | `/studies/$id` | NOT_TESTED | P2 | — |
| `ctrl.studies.detail.regenerate` | Regenerate study | `/studies/$id` | NOT_TESTED | P1 | — |

### trades

| surfaceId | control | route | status | severity | blocker |
| --- | --- | --- | --- | --- | --- |
| `ctrl.trades.filter-category` | Category filter chips | `/trades` | NOT_TESTED | P2 | — |
| `ctrl.trades.filter-all` | Filter All categories | `/trades` | NOT_TESTED | P2 | — |
| `ctrl.trades.post-job-cta` | Post a job CTAs | `/trades` | NOT_TESTED | P1 | — |
| `ctrl.trades.open-job` | Open job card | `/trades` | NOT_TESTED | P1 | — |
| `ctrl.trades.signup-cta` | Create free account CTA | `/trades` | NOT_TESTED | P1 | — |
| `ctrl.trades.job.back` | Back to Trades | `/trades/$jobId` | NOT_TESTED | P2 | — |
| `ctrl.trades.job.edit` | Edit Job | `/trades/$jobId` | NOT_TESTED | P1 | — |
| `ctrl.trades.job.interest-submit` | Submit interest | `/trades/$jobId` | NOT_TESTED | P1 | — |
| `ctrl.trades.job.interest-unauth` | Sign up to register interest | `/trades/$jobId` | NOT_TESTED | P1 | — |
| `ctrl.trades.job.accept` | Accept interest | `/trades/$jobId` | NOT_TESTED | P1 | — |
| `ctrl.trades.job.reject` | Reject interest | `/trades/$jobId` | NOT_TESTED | P1 | — |
| `ctrl.trades.new.submit` | Post job submit | `/trades/new` | NOT_TESTED | P1 | — |
| `ctrl.trades.new.category` | Job category select | `/trades/new` | NOT_TESTED | P2 | — |
| `ctrl.trades.edit.submit` | Save job edit | `/trades/$jobId/edit` | NOT_TESTED | P1 | — |
| `ctrl.trades.profile.submit` | Save trade profile | `/trades/profile` | NOT_TESTED | P1 | — |
| `ctrl.trades.profile.categories` | Toggle trade categories | `/trades/profile` | NOT_TESTED | P2 | — |

## Backend operations

| surfaceId | control | sourcePath | status | severity |
| --- | --- | --- | --- | --- |
| `be.auth.get-current-user` | getCurrentUserServerFn | `src/serverFns/auth.ts` | NOT_TESTED | P0 |
| `be.auth.delete-account` | deleteAccountServerFn | `src/serverFns/auth.ts` | NOT_TESTED | P1 |
| `be.projects.create` | createProjectServerFn | `src/serverFns/projects.ts` | NOT_TESTED | P0 |
| `be.projects.stage-set` | projectStageRepository set stage | `src/features/projects/infrastructure/projectStageRepository.ts` | NOT_TESTED | P1 |
| `be.photos.upload` | photos-write upload batch | `src/lib/photos-write.ts` | PARTIAL | P0 |
| `be.photos.remove` | photos-write / remove photo | `src/lib/photos-write.ts` | NOT_TESTED | P1 |
| `be.photos.health` | checkUploadHealth | `src/features/ai-upload/presentation/checkUploadHealth.ts` | NOT_TESTED | P1 |
| `be.ai.photo-analysis` | runPhotoAnalysisServerFn | `src/features/ai-upload/presentation/serverFns.ts` | NOT_TESTED | P0 |
| `be.ai.photo-analysis-provider` | runPhotoAnalysisWithProviderServerFn | `src/features/ai-upload/presentation/serverFns.ts` | NOT_TESTED | P1 |
| `be.ai.scope` | runScopeAnalysisServerFn | `src/features/ai-design/presentation/serverFns.ts` | NOT_TESTED | P0 |
| `be.ai.redesign` | generateRedesignConceptsServerFn | `src/features/ai-design/presentation/serverFns.ts` | NOT_TESTED | P1 |
| `be.estimate.generate` | generateEstimateServerFn | `src/features/estimate/presentation/serverFns.ts` | NOT_TESTED | P0 |
| `be.estimate.authority-save` | saveAuthorityCategoryEstimateServerFn | `src/features/estimate/presentation/serverFns.ts` | NOT_TESTED | P1 |
| `be.estimate.repository` | supabaseEstimateRepository | `src/features/estimate/infrastructure/repositories/estimate.repository.ts` | NOT_TESTED | P0 |
| `be.roi.engine` | deterministicRoiEngine / runRoiEngine | `src/features/roi/infrastructure/adapters/roi-engine.adapter.ts` | NOT_TESTED | P0 |
| `be.export.pdf` | PDF export pipeline | `src/features/export` | NOT_TESTED | P0 |
| `be.export.queue` | queue feasibility export | `src/features/export` | NOT_TESTED | P1 |
| `be.feasibility.repository` | supabaseFeasibilityRepository | `src/features/feasibility/infrastructure/repositories/feasibility.repository.ts` | NOT_TESTED | P0 |
| `be.studies.queue-export` | feasibilityService.queueExport | `src/features/feasibility/application/feasibilityService.ts` | NOT_TESTED | P0 |
| `be.studies.share` | feasibilityService.share | `src/features/feasibility/application/feasibilityService.ts` | NOT_TESTED | P0 |
| `be.studies.archive` | feasibilityService.archive | `src/features/feasibility/application/feasibilityService.ts` | NOT_TESTED | P0 |
| `be.studies.duplicate` | feasibilityService.duplicate | `src/features/feasibility/application/feasibilityService.ts` | NOT_TESTED | P1 |
| `be.trades.job.create` | createTradesJob | `src/features/trades/infrastructure/repositories/tradesJobStore.ts` | NOT_TESTED | P1 |
| `be.trades.job.update` | updateTradesJob | `src/features/trades/infrastructure/repositories/tradesJobStore.ts` | NOT_TESTED | P1 |
| `be.trades.job.delete` | deleteTradesJob | `src/features/trades/infrastructure/repositories/tradesJobStore.ts` | NOT_TESTED | P2 |
| `be.trades.interest.create` | createTradesJobInterest | `src/features/trades/infrastructure/repositories/tradesJobInterestStore.ts` | NOT_TESTED | P1 |
| `be.trades.interest.update` | updateTradesJobInterestStatus | `src/features/trades/infrastructure/repositories/tradesJobInterestStore.ts` | NOT_TESTED | P1 |
| `be.trades.profile.upsert` | upsertCurrentUserTradeProfile | `src/features/trades/infrastructure/repositories/tradeProfileStore.ts` | NOT_TESTED | P1 |
| `be.marketplace.quote.create` | createQuoteRequest | `src/lib/marketplace-write.ts` | NOT_TESTED | P1 |
| `be.marketplace.message.send` | sendTradeMessage | `src/lib/marketplace-write.ts` | NOT_TESTED | P1 |
| `be.marketplace.favorite.toggle` | addTradeFavorite / removeTradeFavorite via useToggleTradeFavorite | `src/lib/marketplace-write.ts` | NOT_TESTED | P2 |
| `be.sharing.create` | ShareLink create | `src/features/sharing/infrastructure/shareLink.repository.ts` | NOT_TESTED | P1 |
| `be.sharing.list` | ShareLink listByStudy | `src/features/sharing/infrastructure/shareLink.repository.ts` | NOT_TESTED | P1 |
| `be.sharing.revoke` | ShareLink revoke | `src/features/sharing/infrastructure/shareLink.repository.ts` | NOT_TESTED | P1 |
| `be.gallery.repository` | gallery repository | `src/features/gallery/infrastructure/galleryRepository.ts` | NOT_TESTED | P1 |
| `be.gallery.lead` | submitInvestorLead | `src/core/gallery/serverFns.ts` | NOT_TESTED | P1 |
| `be.deal.save` | saveDealOpportunityServerFn | `src/serverFns/dealCopilot.ts` | NOT_TESTED | P1 |
| `be.deal.delete` | deleteDealOpportunityServerFn | `src/serverFns/dealCopilot.ts` | NOT_TESTED | P1 |
| `be.deal.analyze` | analyzeDealServerFn | `src/serverFns/dealAnalysis.ts` | NOT_TESTED | P1 |
| `be.deal.chat.create-thread` | createThreadServerFn | `src/serverFns/dealChat.ts` | NOT_TESTED | P1 |
| `be.deal.chat.list-threads` | listThreadsServerFn | `src/serverFns/dealChat.ts` | NOT_TESTED | P2 |
| `be.deal.chat.list-messages` | listMessagesServerFn | `src/serverFns/dealChat.ts` | NOT_TESTED | P1 |
| `be.deal.chat.send` | sendMessageServerFn | `src/serverFns/dealChat.ts` | BLOCKED_CONFIGURATION | P1 |
| `be.admin.stats` | admin platform stats read | `src/features/admin` | NOT_TESTED | P1 |
| `be.email.send` | Resend email helper | `src/lib/email.ts` | NOT_TESTED | P1 |
| `be.payment.create-checkout` | createCheckout (mock gateway) | `src/platform/payments/index.ts` | NOT_TESTED | P2 |
| `be.payment.has-pro-access` | hasProAccess gate | `src/features/payment/application/hasProAccess.ts` | NOT_TESTED | P1 |
| `be.payment.verify-webhook` | verifyWebhook | `src/features/payment/application/verifyWebhook.ts` | NOT_TESTED | P2 |

## Integrations

| surfaceId | control | exposure | status | severity |
| --- | --- | --- | --- | --- |
| `int.supabase.browser` | Supabase browser client | production-visible | NOT_TESTED | P0 |
| `int.supabase.server` | Supabase server/service client | production-visible | NOT_TESTED | P0 |
| `int.supabase.storage` | Storage buckets project-photos/gallery | production-visible | NOT_TESTED | P0 |
| `int.openai` | OpenAI | production-visible | NOT_TESTED | P0 |
| `int.huggingface` | HuggingFace vision/text | production-visible | NOT_TESTED | P1 |
| `int.resend` | Resend email | production-visible | NOT_TESTED | P1 |
| `int.oauth.google` | Google OAuth provider | production-visible | NOT_TESTED | P0 |
| `int.oauth.apple` | Apple OAuth provider | production-visible | NOT_TESTED | P0 |
| `int.oauth.github` | GitHub OAuth provider | production-visible | NOT_TESTED | P0 |
| `int.payment.mock` | Payment mock adapter | mock-only | NOT_TESTED | P2 |
| `int.payment.pro-flag` | VITE_ENABLE_PRO_FEATURES / domain pro gate | production-visible | NOT_TESTED | P1 |
| `int.posthog` | PostHog analytics | optional | NOT_TESTED | P3 |
| `int.sentry` | Sentry | optional | NOT_TESTED | P2 |
| `int.public-url` | VITE_PUBLIC_URL | production-visible | NOT_TESTED | P1 |
| `int.export.pdf-runtime` | PDF export runtime | production-visible | NOT_TESTED | P0 |

## Confirmed P0 BROKEN surfaces

- `route.analyze` — Photo capture/select broken when no project; free-text project id (blocker: p0-photo-capture-upload)
- `ctrl.analyze.project-select` — Unresolved free-text values possible (blocker: free-text-project-id)
- `ctrl.analyze.photo.take` — Disabled when !selectedProject via isLoading (blocker: isLoading-gated-on-project)
- `ctrl.analyze.photo.library` — Disabled when no project (blocker: isLoading-gated-on-project)
- `ctrl.analyze.photo.camera-input` — Has multiple=true incorrectly (blocker: camera-multiple-attribute)

## Core journey map

| Step | Status | Surfaces |
| --- | --- | --- |
| signup | NOT_TESTED | `ctrl.auth.signup-submit`, `route.auth` |
| signin | NOT_TESTED | `ctrl.auth.signin-submit`, `route.auth` |
| project | NOT_TESTED | `ctrl.projects.new.submit`, `route.projects.new` |
| photos | BROKEN | `ctrl.analyze.photo.take`, `ctrl.analyze.photo.library`, `ctrl.upload.camera`, `route.projects.upload` |
| analysis | NOT_TESTED | `route.projects.analysis`, `be.ai.photo-analysis` |
| scope | NOT_TESTED | `route.projects.scope`, `be.ai.scope` |
| redesign | NOT_TESTED | `be.ai.redesign` |
| estimate | NOT_TESTED | `route.projects.estimate`, `ctrl.estimate.instant.l1-submit` |
| roi | NOT_TESTED | `ctrl.estimate.roi-display`, `be.roi.engine` |
| export | NOT_TESTED | `ctrl.report.export-pdf`, `be.export.pdf` |
| reopen | NOT_TESTED | `route.studies.detail`, `ctrl.studies.open` |
| share_download | NOT_TESTED | `ctrl.studies.detail.share-create`, `ctrl.studies.detail.export-pdf` |

## Validation

```bash
node scripts/validate-functional-surface-register.mjs
pnpm exec tsx --test tests/invariants/functional-surface-register.invariant.test.ts
```

## 4C2E status

4C2E evidence-vault, catalogue-publication and D1 work remain paused until the application operational programme is independently closed.

---

Generated 2026-08-04 by `scripts/build-functional-surface-register.mjs` from inventory phase P0-APP-AR2.
