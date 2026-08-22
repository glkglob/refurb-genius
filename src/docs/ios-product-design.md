# iOS product design — interaction, layout, accessibility

**Status:** In force for Capacitor iOS SPA presentation
**Phase:** IOS-DESIGN-COMPLETION
**Does not:** freeze a release candidate, approve branding, or change IA-0 / auth / mobile API authority
**Related:** `src/docs/design-system.md`, `src/docs/COMPONENT_STANDARDS.md`, IA-0 §11

---

## Scope

This document is the product-design contract for **interaction, layout, accessibility, safe-area handling, theme consistency, and IA-0 presentation surfaces** in the iOS Capacitor shell (`capacitor://localhost`, local `webDir`, no `server.url`).

It is **not** a branding specification. App icon, splash, LaunchScreen, PWA icons, and product marks are owned by a separate phase (`IOS-BRAND-ASSETS-1`).

It is **not** a design-agent skill or Grok rule. Agents follow this file plus `AGENTS.md` and locked IA-0.

---

## Controlling journey

IA-0 remains LOCKED:

> Photos → Analysis → Redesign → Estimate → Export

Project Overview is the project home, not a sixth stage. Global mobile chrome stays:

> Home | Projects | + New | Copilot | More

Stage progress and the single dominant next action take priority inside a project. Users must not open More merely to continue the journey.

---

## Tokens and theme

- Use semantic tokens from `src/styles.css` (`bg-background`, `text-foreground`, `bg-card`, `bg-primary`, `border-border`, `ring-ring`, `bg-field`, …).
- Do not introduce a parallel palette (hardcoded cream/teal/gray/white) on authorised product chrome.
- Dark mode is first-class. Light mode must remain readable.
- Colour is never the sole status signal (wording + icon + semantic treatment).

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

- Apply `env(safe-area-inset-top)` as **padding on the sticky header**, not on a fixed-height inner row.
- Keep the inner row at its designed height (`h-14` authenticated mobile; `h-16` marketing).
- Bottom chrome (sticky next action, composers, footers) uses `max(0.75rem, env(safe-area-inset-bottom))`.
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
