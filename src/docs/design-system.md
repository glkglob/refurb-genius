# Refurb Genius — Design System

**Status:** Work in progress (June 2026)  
**Goal:** Consistent design language for property investment & refurbishment SaaS.  
**Related:** `src/docs/COMPONENT_STANDARDS.md`, `packages/ui/`, `docs/README.md`.

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

| Token           | Light Mode     | Dark Mode              | Usage Example                    |
| --------------- | -------------- | ---------------------- | -------------------------------- |
| `--background`  | Cool off-white | Deep navy slate        | Page backgrounds                 |
| `--card`        | White          | Elevated slate         | Cards, panels                    |
| `--primary`     | Emerald        | Bright emerald         | **Primary CTAs** (filled buttons)|
| `--accent`      | Emerald        | Bright emerald         | Highlights, active nav, links    |
| `--field`       | White          | Solid elevated fill    | Input / select / textarea fill   |
| `--muted`       | Light gray     | Mid slate              | Secondary backgrounds            |
| `--placeholder` | Mid gray       | Soft gray              | Placeholder text                 |
| `--border`      | Light gray     | White ~28%             | Borders                          |

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

- Default: `rounded-xl`, `h-10`
- Primary actions should use `variant="default"` (uses `--primary`)
- Destructive actions use `variant="destructive"`
- Avoid raw `<button>` with custom classes when possible.

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

## 7. Current Gaps (May 2026)

- Many legacy pages still use hardcoded colors (`teal-*`, `gray-*`, `bg-white`).
- Mobile navigation currently has no theme toggle.
- ThemeProvider has a minor hydration flash on first load.
- Not all shadcn components have been updated to new rounding standards.

---

## 8. Enforcement

- New features **must** follow this document.
- Use the `grok-refurb-platform-builder` skill when working inside this codebase.
- When reviewing PRs, check for use of semantic tokens vs hardcoded colors.

---

## 9. Component Migration Checklist (Current Priority)

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

**Last Updated:** May 2026
**Owner:** Grok (technical build assistant)
