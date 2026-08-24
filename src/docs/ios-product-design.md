# iOS product design — interaction, layout, accessibility

**Status:** In force for Capacitor iOS SPA presentation
**Phase:** IOS-DESIGN-COMPLETION
**Does not:** freeze a release candidate, approve branding, or change IA-0 / auth / mobile API authority
**Related:** `src/docs/design-system.md`, `src/docs/COMPONENT_STANDARDS.md`, IA-0 §11

Authenticated Home/Dashboard composition, naming, Project Brief, Workflow Board, and uniform Projects presentation in this file are **approved design targets**. They are not a claim that the current `/dashboard` or `/projects` UI already matches them.

---

## Scope

This document is the product-design contract for **interaction, layout, accessibility, safe-area handling, theme consistency, and IA-0 presentation surfaces** in the iOS Capacitor shell (`capacitor://localhost`, local `webDir`, no `server.url`).

It is **not** a branding specification. App icon, splash, LaunchScreen, PWA icons, and product marks are owned by a separate phase (`IOS-BRAND-ASSETS-1`).

It is **not** a design-agent skill or Grok rule. Agents follow this file plus `AGENTS.md` and locked IA-0.

---

## Controlling journey

IA-0 remains LOCKED:

> Photos → Analysis → Redesign → Estimate → Export

Project Overview is the interior project home, not a sixth stage and not a substitute for Dashboard/Home or the Projects list.

The destination row is a **bottom** bar (`MobileBottomNav`). The top bar is identity/profile chrome only. Visible product name is **Deal Copilot**, not “Copilot”.

Stage progress and the single dominant next action take priority **inside a project**. Users must not open More merely to continue the journey.

Authenticated desktop **light** mode uses a dark left Sidebar and a light workspace. Dark mode keeps the working dark product experience. Persistent Sidebar starts at `lg`; below `lg` the bottom destination bar is used.

---

## Authenticated naming and surfaces (approved design)

Supersedes older wording that named Dashboard “My projects”, treated Dashboard and Projects as the same list, omitted Marketplace from desktop navigation, or featured the first Projects row.

Current `/dashboard` (Continue / featured card / Other projects / “My projects”) is **not** the approved final Dashboard. Implementation of the composition below remains pending separately authorised work.

### Canonical naming

The authenticated route may remain `/dashboard`. Public marketing Home is unchanged. Stable implementation IDs and routes are not changed by this documentation.

**Mobile authenticated navigation (fixed five-item row):**

| Position | Visible label |
| -------- | ------------- |
| 1 | Home |
| 2 | Projects |
| 3 | New |
| 4 | Deal Copilot |
| 5 | More |

Mobile authenticated Dashboard-route page heading: **Home**.

**Desktop authenticated navigation:**

| Position | Visible label |
| -------- | ------------- |
| 1 | Dashboard |
| 2 | Projects |
| 3 | New Analysis |
| 4 | Deal Copilot |
| 5 | Marketplace |
| 6 | Settings |

Desktop authenticated Dashboard-route page heading: **Dashboard**.

The canonical portfolio heading is **Projects**. **“My projects”** is not a current canonical authenticated page name, Dashboard/Home heading, or governing surface name.

`globalNav.ts` remains the single authenticated navigation authority. The stable Marketplace item ID remains `trades_marketplace`; canonical visible label `Marketplace`; canonical authenticated destination `/marketplace`. Web Sidebar and mobile More derive that label and destination from the canonical item; there is no Sidebar-only label or destination map. `/trades` remains the public Trades board beneath Marketplace.

### Dashboard / Home

Approved default order:

1. Project Brief
2. Workflow Board

Project Brief is visible by default. The user must be able to hide it, restore it, and retain that preference between sessions. When it is hidden, Workflow Board remains visible, becomes the primary Dashboard surface, and no empty Project Brief container or unexplained gap remains.

How that preference is stored (device-local, browser-local, native-local, or account-synchronised) is **PENDING DATA-CONTRACT VALIDATION**.

Project Brief and Workflow Board must use consistent shared workflow evidence and must not contradict stage, status, attention, readiness, or next action. The shared summary authority required for that consistency is **PENDING DATA-CONTRACT VALIDATION**.

### Project Brief

A concise cross-project summary of the most important decisions, attention items, readiness items, and next actions. Not a copy of Projects and not a second workflow board. Because Workflow Board follows immediately, do not duplicate a separate “Workflow snapshot” inside Project Brief.

Each displayed item may contain project name, location, a concise reason for attention / readiness / waiting, and the existing authoritative contextual action. Do not invent a second next-action resolver.

Item-selection rule, priority ordering, maximum item count, summary contract, loading behaviour, and empty state remain **PENDING DATA-CONTRACT VALIDATION**.

### Workflow Board

Approved Option 2 cross-project workflow overview. Canonical stage order: Photos → Analysis → Redesign → Estimate → Export.

**Desktop:** five ordered columns. Each column shows the canonical stage name, the count of active projects currently assigned to that stage, and compact project cards (name, location, current status, connected five-stage progress, Open). Each active project appears once under its current authoritative stage.

**Mobile:** the same five stages, order, placement, and counts as vertically stacked sections, not compressed columns. Compact rows or cards with name, location, status, five-stage progress, and Open. Do not introduce page-level horizontal overflow.

Workflow Board is evidence-based. It is **not** a manually editable Kanban board: no drag-and-drop, no manual stage movement, no status mutation from this surface, no second workflow resolver, and no route-level workflow calculations that conflict with existing authority. Stage placement must derive from shared authoritative workflow evidence. The classification contract for all active projects is **PENDING DATA-CONTRACT VALIDATION**.

### Projects

Projects is the separate uniform portfolio workspace. Heading: **Projects** (not “My projects”). It must not reproduce Home/Dashboard composition.

Approved presentation for every project: compact uniform rows or cards; media area or authorised placeholder; name; address, postcode, or location fallback; status or attention; connected five-stage progress (Photos → Analysis → Redesign → Estimate → Export); Open project. Desktop should show multiple consistent rows in a normal viewport. Mobile should stack compact cards or rows without page-level horizontal overflow.

No project receives a featured or hero hierarchy because it appears first. Do not document or reintroduce a featured first project, “Continue where you left off”, Project Brief, Workflow Board columns, or a separate next-action resolver on this list.

Known current implementation mismatch (not repaired here): `/projects` still uses `layout={index === 0 ? "featured" : "row"}`. That remains pending a separately authorised repair.

### Surface responsibility

| Surface | Responsibility |
| ------- | -------------- |
| Dashboard / Home | Concise cross-project brief; priority decisions and next actions; active projects grouped by authoritative workflow stage; resume or open the relevant project. |
| Projects | Complete uniform portfolio; browse and compare; consistent progress; open the selected project. |
| Project overview | Interior five-stage working experience, separate from Dashboard/Home and the Projects list. |

Dashboard/Home and Projects are not duplicate surfaces.

### Marketplace

Marketplace is the authenticated parent for My Jobs, My Interests, Post a Job, Trades board, directory, quotes, messages/inbox, and favourites.

Desktop: after Deal Copilot, before Settings. Mobile: through More — it must not replace one of the five fixed destinations.

### Shell and brand direction

Desktop: persistent dark navy left sidebar, light central workspace, separate right-side Deal Copilot rail, visible boundaries, restrained emerald accents.

Mobile: fixed safe-area-aware bottom navigation (Home, Projects, New, Deal Copilot, More), compact responsive content, no page-level horizontal overflow.

Dark treatment uses layered navy surfaces and visible boundaries — not an indistinguishable near-black field.

Brand direction: deep navy `#0D2139`, emerald `#188E67`, white and light/ivory workspace surfaces, readable text, visible layered boundaries, restrained accent use.

---

## Tokens and theme

- Use semantic tokens from `src/styles.css` (`bg-background`, `text-foreground`, `bg-card`, `bg-primary`, `border-border`, `ring-ring`, `bg-field`, …).
- Do not introduce a parallel palette (hardcoded cream/teal/gray/white) on authorised product chrome.
- Authenticated Web A light mode applies the approved dark-left-navigation / light-workspace hierarchy (RG-UI-01). The Sidebar uses navy / ivory as component-local classes aligned with brand direction deep navy `#0D2139` and light/ivory workspace surfaces. `src/styles.css` semantic OKLCH tokens carry the same direction: ivory page, near-white cards, navy text, emerald actions in light; layered navy surfaces (not near-black) in dark. Popovers stay opaque.
- Trades, Post a Job, studies and onboarding do not occupy Dashboard/Home first paint. First paint is Project Brief then Workflow Board (approved target; see Authenticated naming and surfaces).
- Dark mode is first-class. Light mode must remain readable.
- Colour is never the sole status signal (wording + icon + semantic treatment).
- Product UI typography remains sans-serif (Inter). Serif treatment belongs to brand artwork only.

---

## Touch targets

Interactive controls on iOS MUST be at least **44 × 44 CSS pixels**.

Live primitive baseline:

| Control                    | Size          |
| -------------------------- | ------------- |
| Button `default` / `touch` | `h-11` (44px) |
| Button `lg`                | `h-12`        |
| Button `icon`              | `h-11 w-11`   |
| Input / Select trigger     | `h-11`        |
| Primary mobile nav items   | `h-11`        |

Do not use `size="sm"` (`h-9`) for a primary journey CTA.

---

## Safe area

`viewport-fit=cover` is required (root meta).

Contract (IOS-UX-1B):

- Apply `env(safe-area-inset-top)` as **padding on the sticky header**, not on a compressed inner row.
- Authenticated mobile identity header uses `min-h-14` so large text can wrap.
- Bottom destination bar owns `env(safe-area-inset-bottom)`.
- Sticky journey CTAs sit **above** the bottom destination bar and must not share its layer.
- Sticky journey CTAs must not cover primary content or legal Footer links.

Prefer `min-h-dvh` over `min-h-screen` on full-height iOS shells.

---

## Keyboard

Do not add Capacitor Keyboard / StatusBar plugins in this contract.

Presentation approach:

- sticky (not necessarily `fixed`) submit rows for long forms;
- `inputMode` on numeric fields;
- 44px fields;
- composers include bottom safe-area padding.

If CSS is insufficient after physical review, a **separate** plugin slice is required.

---

## Loading, empty, error, recovery

- `LoadingState` exposes `role="status"` and `aria-live="polite"`.
- `EmptyState` is a status region with a title; recovery actions stay 44px.
- Journey stages SHOULD keep `ProjectWorkflowShell` once project identity is known.
- Bare `AppLayout` is allowed only when project identity is unavailable.

---

## Accessibility

Release-gate list from IA-0 §11:

- keyboard operation;
- visible focus (`focus-visible:ring-2 ring-ring`);
- semantic labels;
- sufficient contrast via tokens;
- touch-safe targets;
- screen-reader-compatible status;
- non-colour-only meaning;
- reduced-motion: do not add motion when `prefers-reduced-motion: reduce`.

Authenticated shell MUST provide a skip link to `#main-content`.

---

## Native `/` entry (presentation only)

Implemented only in `src/routes/index.tsx`.

Uses existing `observeNativeAuthIdentity(context.queryClient)` from `@/features/auth`.

| Outcome                                 | Destination                                            |
| --------------------------------------- | ------------------------------------------------------ |
| native `authenticated`                  | `/dashboard`                                           |
| native `signed-out`                     | `/auth`                                                |
| native `indeterminate` / observer error | `/auth` (fail closed; do not publish false signed-out) |
| web `/`                                 | existing public landing, unchanged                     |

No new auth hook, token reader, persistence, or session authority.

---

## Local unsaved photo preview

Unsaved `File[]` preview remove controls MUST be 44 × 44, file-specific `aria-label`, keyboard and touch operable, and disabled while the zone is blocked.

They MUST NOT change persisted-photo deletion, Storage, or database authority.

Do not reuse `PhotoRemoveButton` for this contract: that control shrinks to `h-7 w-7` under `pointer-fine`, which is below 44px.

---

## Explicitly out of scope

- Branding, icons, splash, LaunchScreen, PWA marks
- IA-0 authority, resolver semantics, Redesign currentness / provenance
- Auth application/infrastructure, native Keychain, mobile API, RLS, Storage, schema
- Capacitor plugins, `package.json`, `.grok/**`
- Physical iPhone certification, TestFlight, RC freeze
