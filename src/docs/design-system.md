# Refurb Genius — Design System

**Status:** In force for product chrome (August 2026)
**Goal:** Consistent design language for property investment & refurbishment SaaS.
**Related:** `src/docs/COMPONENT_STANDARDS.md`, `src/docs/ios-product-design.md`, `packages/ui/`, `docs/README.md`.

---

## 1. Core Principles

- **Navy primary, Teal accent** — Navy `#0D2139` is the primary action and text colour. Teal `#1B8D68` is accent / secondary. Light page canvas is `#F4F6F8`. Supporting section / background band is `#F2F5F6` light / `#14283E` dark (`--section`, not a brand primary). White `#FFFFFF` is the light elevated card / panel surface. Dark elevated card is `#162A41` and dark nested / inset is `#102338` — supporting implementation surfaces, not additional brand-primary colours.
- **Semantic tokens first** — Always prefer design tokens (`bg-primary`, `text-accent-text`, `text-primary-foreground`, etc.) over hardcoded colors.
- **Dark mode is first-class** — The product must look excellent in both light and dark mode.
- **Generous but disciplined rounding** — We favor `rounded-xl` and `rounded-2xl`.
- **Clear visual hierarchy** — Strong use of typography weight, color, and spacing.
- **Accessibility** — Minimum contrast ratios must be respected. Normal-size
  text uses `--accent-text` (or another readable semantic), not Teal. Large
  text may use Teal only where 3:1 is met.

---

## 2. Color System

We use **CSS Variables** (defined in `src/styles.css`). Brand primitives are exact hex (`#0D2139`, `#1B8D68`, `#FFFFFF`). Supporting surfaces may be exact approved HEX or opaque `color-mix` values derived from Navy / White (Teal for non-text accent). `#162A41` (dark `--card`) and `#102338` (dark `--inset`) are supporting implementation surfaces, not additional brand primaries. `--popover` remains opaque `oklch` for the overlay invariant.

### Global visual authority (current)

| Role | Value | Notes |
| ---- | ----- | ----- |
| Navy — PRIMARY | `#0D2139` | Light foreground and primary action fill; dark background |
| Teal — ACCENT / SECONDARY | `#1B8D68` | Ring, progress, icons, selection indicators. Do not brighten in dark mode. Do not use as small normal text on White (4.15:1) or as White-on-Teal for AA-normal-text. |
| White — SURFACE | `#FFFFFF` | Light elevated card / panel / field |

Approved horizontal logos (byte-authoritative):

- Light `src/assets/brand/logo-light-horizontal.png` SHA-256 `d14a6382bfb50c4ea933ae671f82a8fbae5f2511be648f4f07ef17b452094629`
- Dark `src/assets/brand/logo-dark-horizontal.jpg` SHA-256 `683792928841dbe439702a529d17a9fbceeafb9815c9ab05b1f96eb490655b20`

Compact identity is **leaf + sparkle**. Compact-mark wiring into Sidebar / Navbar / Auth / PWA is a later slice. Render wide marks through `BrandLogo`.

### Semantic Tokens (Recommended Usage)

| Token           | Light Mode                         | Dark Mode                         | Usage Example                    |
| --------------- | ---------------------------------- | --------------------------------- | -------------------------------- |
| `--background`  | Canvas `#F4F6F8`                   | Navy `#0D2139`                    | Page / main workspace            |
| `--foreground`  | Navy `#0D2139`                     | White `#FFFFFF`                   | Body text                        |
| `--card`        | White `#FFFFFF`                    | Elevated card `#162A41` (supporting, not a brand primary) | Cards, panels                    |
| `--section`     | Supporting band `#F2F5F6`          | Supporting band `#14283E`         | Section / grouped background     |
| `--inset`       | Reuses `--section` `#F2F5F6` (no new light HEX) | Nested / inset `#102338` (supporting, not a brand primary) | Nested wells / inset surfaces    |
| `--primary`     | Navy `#0D2139`                     | White `#FFFFFF`                   | **Primary CTAs** (filled buttons)|
| `--primary-foreground` | White `#FFFFFF`              | Navy `#0D2139`                    | Text on primary fill             |
| `--accent`      | Teal `#1B8D68`                     | Teal `#1B8D68` (not brightened)   | Icons, thick indicators          |
| `--accent-text` | Navy `#0D2139`                     | White `#FFFFFF`                   | Normal-size accent labels        |
| `--ring`        | Teal `#1B8D68`                     | Teal `#1B8D68`                    | Non-field focus / selection rings|
| `--sidebar`     | Navy `#0D2139`                     | Navy `#0D2139`                    | Persistent desktop sidebar       |
| `--sidebar-foreground` | White `#FFFFFF`              | White `#FFFFFF`                   | Sidebar text                     |
| `--field`       | White                              | Raised navy                       | Input / select / textarea fill   |
| `--field-ring`  | Teal `#1B8D68`                     | White `#FFFFFF`                   | Field focus indicator            |
| `--muted`       | Navy mixed into White              | Nested `--inset` `#102338`        | Secondary / nested backgrounds   |
| `--placeholder` | Navy 62% / White                   | White 62% / Navy                  | Placeholder text (≥ 4.5:1)       |
| `--border`      | Opaque Navy/White mix              | Opaque White/Navy mix             | Borders and hierarchy            |
| `--popover`     | Opaque White (`oklch`)             | Opaque raised navy (`oklch`)      | Menus / overlays                 |

**Never hardcode:**

- `bg-white`, `bg-gray-50`, `text-gray-600`, `text-teal-*`, `border-teal-*` etc. in production components.

---

## 3. Typography

- **Font:** Cormorant Garamond (self-hosted). Application-controlled UI inherits this family unless a technical exception applies (monospace / `font-mono`, OS UI, third-party embeds, email HTML, PDF engines, emoji fallbacks).
- **Weights:** Regular 400 and Semibold 600 only. Semantic `medium` maps to 400; `semibold` / `bold` / `extrabold` map to 600. Do not synthesise italic or unapproved weights. Do not globally remap `font-medium` to 600 — that would incorrectly thicken helpers, form labels, and body copy.
- **Supporting / body / helper information:** Regular (400)
- **Important headings, navigation, actions, status labels, and key values:** Semibold (600), including shared `Button` and `Badge` bases
- **Important metric numerals:** Semibold (600) plus lining and tabular figures (`lining-nums tabular-nums`). Do not apply lining/tabular figures to all body text.
- **Headings:** Semibold (600)
- **Body:** Regular (400), good line height
- **Labels:** Regular (400), slightly smaller

---

## 4. Border Radius

| Class         | Value   | When to use                     |
| ------------- | ------- | ------------------------------- |
| `rounded-lg`  | 0.5rem  | Badges, small pills             |
| `rounded-xl`  | 0.75rem | Buttons, Inputs, Select, Tabs   |
| `rounded-2xl` | 1rem    | Cards, Dialogs, major surfaces  |
| `rounded-3xl` | 1.5rem  | Hero sections, large containers |

---

## 5. Component Standards

### Button

- Default: `rounded-xl`, `h-11` (44px mobile baseline)
- `size="icon"`: `h-11 w-11`
- Primary actions should use `variant="default"` (uses `--primary`)
- Destructive actions use `variant="destructive"`
- Avoid raw `<button>` with custom classes when possible.
- Do not use `size="sm"` for a primary iOS journey CTA. See `src/docs/ios-product-design.md`.

### Card

- Default: `rounded-2xl`, `border`, `shadow-sm`
- Use `bg-card` (never `bg-white`)

### Input / Textarea / Select

- Default: `rounded-xl`
- Strong field focus ring (`ring-2 ring-field-ring`) without opacity that drops the indicator below 3:1

### Navigation

- Use semantic colors only (`text-muted-foreground`, `hover:text-foreground`)
- No more multi-color nav links (blue, purple, amber, etc.)
- Public light-mode top-navigation **controls** (Dashboard, Deal Copilot, Trades, Post Job, Sign in, theme toggle) are raised White `--card` (`#FFFFFF`) against canvas `--background` (`#F4F6F8`), with Navy `--foreground` text, semantic `--border`, and hover `--section` (`#F2F5F6`). Do not solve this by painting only the Navbar shell White while leaving transparent controls.
- Dark-mode equivalent uses raised `--card` (`#162A41`) against Navy canvas (`#0D2139`). Do not use White pills in dark mode.
- Get started remains the primary Navy CTA (`variant="default"` / `--primary`). Secondary destinations are raised card controls, not primary-filled.

### Status / Badges

- Use the `<Badge>` component with variants: `default`, `secondary`, `destructive`, `outline`

---

## 6. Dark Mode Rules

- All components **must** work in both modes using semantic tokens.
- When adding new UI, test both light and dark.
- Avoid `dark:` modifiers unless absolutely necessary (prefer tokens).

---

## 7. Authenticated product surfaces (approved design)

This section is **approved forward-looking design authority**. It supersedes older wording that treated Dashboard/Home as a “My projects” list, that featured the first Projects row, or that omitted Marketplace from desktop navigation.

It does **not** prove current implementation. Project Brief, Workflow Board, hide/restore persistence, Home/Dashboard page headings, removal of “My projects”, and uniform Projects rows remain **approved targets pending separately authorised implementation**. Interaction, layout, and iOS chrome rules remain in `src/docs/ios-product-design.md`.

### 7.1 Canonical naming

The authenticated route may remain `/dashboard`. This does not rename the public marketing Home surface. Stable implementation IDs and routes are not changed by this documentation.

**Mobile authenticated navigation (fixed bottom row):**

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

**Projects** is the canonical portfolio heading. **“My projects”** is not a current canonical authenticated page name, Dashboard/Home heading, or governing surface name.

### 7.2 Dashboard / Home composition

Approved default order on authenticated Home/Dashboard:

1. **Project Brief** — elevated `--card` surface
2. **Workflow Board** — grouped on the supporting `--section` band against the page canvas; cards inside remain `--card`

Project Brief is visible by default. The user must be able to hide it, restore it, and retain that preference between sessions. When it is hidden, Workflow Board remains visible, occupies the primary Dashboard position, and no empty Project Brief container or unexplained gap remains.

Persistence mechanism (device-local, browser-local, native-local, or account-synchronised) is **PENDING DATA-CONTRACT VALIDATION**. Do not treat any storage choice as approved.

Project Brief and Workflow Board must use consistent project and workflow evidence. They must not contradict current stage, status, attention, readiness, or next action. The shared summary authority required for that consistency is **PENDING DATA-CONTRACT VALIDATION**.

### 7.3 Project Brief

Project Brief is a concise cross-project summary of the most important decisions, attention items, readiness items, and next actions.

It is not another copy of Projects and not a second workflow board. Because Workflow Board follows immediately, do not duplicate a separate “Workflow snapshot” inside Project Brief.

Each displayed item may contain:

- project name;
- location;
- concise reason for attention, readiness, or waiting;
- the existing authoritative contextual action.

Project Brief must not invent a second next-action resolver. It must consume existing authoritative workflow and continuation evidence.

Exact item-selection rule, priority ordering, maximum item count, summary contract, loading behaviour, and empty state remain **PENDING DATA-CONTRACT VALIDATION**. Do not invent those details here.

### 7.4 Workflow Board

Workflow Board is the approved Option 2 cross-project workflow presentation. It shows workflow position across active projects at a glance. On Dashboard it sits on the supporting `--section` surface so the five-stage board reads as a grouped section against the global canvas.

Canonical five-stage order:

1. Photos
2. Analysis
3. Redesign
4. Estimate
5. Export

**Desktop:** five ordered columns (Photos, Analysis, Redesign, Estimate, Export). Each column shows the canonical stage name, the count of active projects assigned to that stage, and compact project cards.

**Mobile:** the same five stages, same order, same authoritative placement, and same stage counts, presented as vertically stacked sections — not compressed desktop columns. Do not introduce page-level horizontal overflow.

Each card or row may display project name, location, current status, connected five-stage progress, and Open. Each active project appears **once** under its current authoritative workflow stage.

Workflow Board is an evidence-based overview. It is **not** a manually editable Kanban board. Do not drag-and-drop, move stages manually, mutate status from this surface, invent a second workflow resolver, or calculate workflow in the route in conflict with existing authority.

Stage placement must derive from shared authoritative workflow evidence. The exact summary/data contract that classifies all active projects is **PENDING DATA-CONTRACT VALIDATION**.

### 7.5 Projects

Projects is the separate uniform portfolio workspace. It must not reproduce Home/Dashboard composition (no Project Brief, no Workflow Board columns, no “Continue where you left off”, no featured first project).

Projects answers: what projects exist; what stage each has reached; which need attention; which the user wants to open.

Approved presentation for **every** project:

- compact uniform rows or cards;
- project media area or authorised placeholder;
- project name;
- address, postcode, or available location fallback;
- status or attention indication;
- connected five-stage progress in canonical order Photos → Analysis → Redesign → Estimate → Export;
- Open project.

Desktop should show multiple consistent rows in a normal viewport. Mobile should use compact stacked cards or rows without page-level horizontal overflow.

Do not use “My projects” as the heading.

Known current implementation mismatch (not repaired by this documentation): `/projects` still features its first project (`index === 0 ? "featured" : "row"`). That remains a pending separately authorised repair.

### 7.6 Surface responsibility

| Surface | Responsibility |
| ------- | -------------- |
| Dashboard / Home | Concise cross-project brief; priority decisions and next actions; active projects grouped by authoritative workflow stage; resume or open the relevant project. |
| Projects | Complete uniform portfolio; browse and compare; consistent progress; open the selected project. |
| Project overview | Interior five-stage working experience. Separate from both Dashboard/Home and the Projects list. |

Dashboard/Home and Projects are not duplicate surfaces.

### 7.7 Marketplace

Marketplace remains the authenticated parent presentation area.

Desktop position: after Deal Copilot, before Settings.

Marketplace contains or provides access to My Jobs, My Interests, Post a Job, Trades board, directory, quotes, messages/inbox, and favourites.

On mobile, Marketplace is reached through **More**. It must not replace one of the five fixed bottom destinations.

### 7.8 Shell and brand direction (unchanged)

Desktop: persistent dark navy left sidebar, light central workspace, separate right-side Deal Copilot rail, visible boundaries, restrained Teal accents.

Mobile: fixed safe-area-aware bottom navigation (Home, Projects, New, Deal Copilot, More), compact responsive content, no page-level horizontal overflow.

Dark treatment uses layered navy surfaces and visible boundaries — not an indistinguishable near-black field.

Brand direction: Navy `#0D2139` (primary), Teal `#1B8D68` (accent / secondary), light canvas `#F4F6F8`, supporting section `#F2F5F6` / `#14283E`, White `#FFFFFF` (light elevated card / panel), dark elevated card `#162A41`, dark nested / inset `#102338`. `#162A41` and `#102338` are supporting implementation surfaces, not additional brand-primary colours. Readable text, visible layered boundaries, restrained accent use.

---

## 8. Current Gaps

- Some legacy pages still use hardcoded colors (`teal-*`, `gray-*`, `bg-white`).
- ThemeProvider may still flash on first load (not an iOS interaction-slice repair unless the provider file is authorised).
- Branding (app icon, splash, LaunchScreen, PWA marks) is **not** owned here — see `IOS-BRAND-ASSETS-1`.
- iOS interaction/layout/safe-area rules live in `src/docs/ios-product-design.md`.
- Home/Dashboard Project Brief + Workflow Board, Home/Dashboard headings, removal of “My projects”, and uniform Projects rows are approved design targets, not current implementation.

---

## 9. Enforcement

- New features **must** follow this document.
- Use the `grok-refurb-platform-builder` skill when working inside this codebase.
- When reviewing PRs, check for use of semantic tokens vs hardcoded colors.

---

## 10. Component Migration Checklist (Current Priority)

See the more detailed and enforceable rules in:
**`src/docs/COMPONENT_STANDARDS.md`**

Use this when cleaning up legacy code:

- [ ] Replace `bg-white` / `bg-gray-50` → `bg-card` or `bg-background`
- [ ] Replace `text-gray-600` / `text-gray-700` → `text-muted-foreground` or `text-foreground`
- [ ] Replace `bg-teal-*` / `text-teal-*` / `border-teal-*` → semantic tokens (`primary`, `accent`, etc.)
- [ ] Replace `rounded-md` on cards/surfaces → `rounded-2xl`
- [ ] Replace raw `<button>` and `<input>` with `<Button>` and `<Input>` components where possible
- [ ] Ensure field controls use `focus-visible:ring-2 ring-field-ring`
- [ ] Use `text-accent-text` for normal-size accent labels; keep Teal on icons/indicators

---

**Last Updated:** 1 September 2026
**Owner:** Product design documentation (interaction/layout). Compact-mark and iOS AppIcon integration remain separate slices.
