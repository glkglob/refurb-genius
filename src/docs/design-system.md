# Refurb Genius — Design System

**Status:** In force for product chrome (August 2026)
**Goal:** Consistent design language for property investment & refurbishment SaaS.
**Related:** `src/docs/COMPONENT_STANDARDS.md`, `src/docs/ios-product-design.md`, `packages/ui/`, `docs/README.md`.

---

## 1. Core Principles

- **Single accent color** — We use **Emerald** as the primary brand accent.
- **Semantic tokens first** — Always prefer design tokens (`bg-primary`, `text-accent-foreground`, etc.) over hardcoded colors.
- **Dark mode is first-class** — The product must look excellent in both light and dark mode.
- **Generous but disciplined rounding** — We favor `rounded-xl` and `rounded-2xl`.
- **Clear visual hierarchy** — Strong use of typography weight, color, and spacing.
- **Accessibility** — Minimum contrast ratios must be respected.

---

## 2. Color System

We use **CSS Variables** (defined in `src/styles.css`) with OKLCH.

### Primary Accent (Emerald brand)

- **Light:** deep emerald CTA / `--primary` + `--accent`
- **Dark:** bright emerald CTA / `--primary` + `--accent` (high L for contrast on navy)

### Semantic Tokens (Recommended Usage)

| Token           | Light Mode                         | Dark Mode                         | Usage Example                    |
| --------------- | ---------------------------------- | --------------------------------- | -------------------------------- |
| `--background`  | Ivory (`#F5EFE5` direction)        | Layered navy (`#0B1F35` direction)| Page / main workspace            |
| `--card`        | Near-white                         | Raised navy above the page        | Cards, panels                    |
| `--primary`     | Emerald (`#169C70` direction)      | Brighter emerald                  | **Primary CTAs** (filled buttons)|
| `--accent`      | Emerald                            | Brighter emerald                  | Highlights, active nav, links    |
| `--field`       | Near-white                         | Mid navy, distinct from page      | Input / select / textarea fill   |
| `--muted`       | Soft ivory-gray                    | Mid navy                          | Secondary backgrounds            |
| `--placeholder` | Mid gray                           | Soft ivory-gray                   | Placeholder text                 |
| `--border`      | Visible warm gray                  | Visible navy edge (opaque)        | Borders and hierarchy            |
| `--popover`     | Opaque near-white                  | Opaque raised navy                | Menus / overlays                 |

**Never hardcode:**

- `bg-white`, `bg-gray-50`, `text-gray-600`, `text-teal-*`, `border-teal-*` etc. in production components.

---

## 3. Typography

- **Font:** Inter (system)
- **Headings:** Semibold / Bold, tight tracking
- **Body:** Regular, good line height
- **Labels:** Medium weight, slightly smaller

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
- Strong focus ring (`ring-2 ring-ring`)

### Navigation

- Use semantic colors only (`text-muted-foreground`, `hover:text-foreground`)
- No more multi-color nav links (blue, purple, amber, etc.)

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

1. **Project Brief**
2. **Workflow Board**

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

Workflow Board is the approved Option 2 cross-project workflow presentation. It shows workflow position across active projects at a glance.

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

Desktop: persistent dark navy left sidebar, light central workspace, separate right-side Deal Copilot rail, visible boundaries, restrained emerald accents.

Mobile: fixed safe-area-aware bottom navigation (Home, Projects, New, Deal Copilot, More), compact responsive content, no page-level horizontal overflow.

Dark treatment uses layered navy surfaces and visible boundaries — not an indistinguishable near-black field.

Brand direction: deep navy `#0D2139`, emerald `#188E67`, white and light/ivory workspace surfaces, readable text, visible layered boundaries, restrained accent use.

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
- [ ] Ensure all new components use `focus-visible:ring-2 ring-ring`

---

**Last Updated:** 24 August 2026
**Owner:** Product design documentation (interaction/layout). Branding is a separate phase.
