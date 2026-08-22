# Refurb Genius — Component Standards

**Version:** 1.2
**Last Updated:** August 2026
**Purpose:** Component usage rules for this codebase. Import shared primitives from
`@repo/ui` (migrating from `src/components/ui/` shims). Index: `docs/README.md`.
iOS interaction/layout: `src/docs/ios-product-design.md`.

---

## 1. General Rules

### Must Follow

- Always use semantic design tokens (`bg-card`, `text-foreground`, `border-border`, `ring-ring`, etc.).
- Prefer our custom components (`<Button>`, `<Card>`, `<Input>`, etc.) over raw HTML elements.
- Use `rounded-xl` for interactive elements (buttons, inputs) and `rounded-2xl` for surfaces (cards, dialogs).
- All components must support both light and dark mode without extra `dark:` classes when possible.
- Focus rings must be visible (`focus-visible:ring-2 ring-ring`).

### Forbidden Patterns

- Hardcoded colors: `bg-white`, `bg-gray-*`, `text-gray-*`, `bg-teal-*`, `text-teal-*`, `border-teal-*`
- Using `rounded-md` or `rounded-sm` on cards and major surfaces
- Raw `<button>` or `<input>` in new code (use our components)
- Multi-color navigation links

---

## 2. Button Standards

**Recommended Usage:**

```tsx
// Primary action
<Button>Save Project</Button>

// Destructive
<Button variant="destructive">Delete</Button>

// Secondary
<Button variant="secondary">Cancel</Button>

// Subtle
<Button variant="ghost">Edit</Button>

// With icon
<Button>
  <Plus className="h-4 w-4" />
  New Project
</Button>
```

**Do not:**

- Use `bg-teal-600` or similar on buttons.
- Use very small buttons (`size="sm"`) for primary actions.

---

## 3. Card Standards

**Recommended Usage:**

```tsx
<Card>
  <CardHeader>
    <CardTitle>Project Details</CardTitle>
  </CardHeader>
  <CardContent>{/* content */}</CardContent>
</Card>
```

- Default padding on `CardContent` is `p-6`.
- Use `rounded-2xl` (already set in the component).

---

## 4. Form Controls

| Component | Recommended Classes / Usage     | Notes                           |
| --------- | ------------------------------- | ------------------------------- |
| Input     | Use `<Input />` directly        | `rounded-xl`, strong focus ring |
| Textarea  | Use `<Textarea />`              | Minimum `min-h-[80px]`          |
| Select    | Use `<Select>` from our wrapper | `rounded-xl` trigger            |
| Checkbox  | Use `<Checkbox />`              | `rounded-md`                    |
| Switch    | Use `<Switch />`                | Larger size (`h-6`)             |

---

## 5. Navigation & Links

- Use `text-muted-foreground` + `hover:text-foreground`
- Active state: `text-foreground font-medium` or `bg-accent`
- Never use colored links (`text-blue-600`, `text-purple-600`, etc.)

---

## 6. Status & Feedback

- Use `<Badge>` for status labels.
- Preferred variants: `default`, `secondary`, `destructive`, `outline`
- For score/priority indicators, prefer semantic colors (`text-accent`, `text-destructive`)

---

## 7. Responsive & Mobile

- All interactive elements should have minimum 44px (`h-11` / `min-h-11`) touch target on mobile.
- Button `size="icon"` is `h-11 w-11`. Do not use `size="sm"` for primary journey actions.
- Safe-area: pad the sticky header, not a fixed-height inner row. Bottom chrome uses `env(safe-area-inset-bottom)`.
- Prefer `min-h-dvh` on full-height iOS shells.
- Use `md:` breakpoints for desktop-only elements (e.g., Sidebar).
- Details: `src/docs/ios-product-design.md`.

---

## 8. Dark Mode Checklist (for new components)

- [ ] Uses `bg-card`, `bg-background`, `text-foreground`
- [ ] Borders use `border-border`
- [ ] Focus states use `ring-ring`
- [ ] Hover states use `hover:bg-accent` or `hover:bg-secondary`
- [ ] No hard-coded light-only colors (`bg-white`, `text-gray-700`, etc.)

---

## 9. When to Create New Components

Create a new component only when:

- The pattern is used in 3+ places, **or**
- The logic is complex (e.g., DataTable, DealScoreCard)

Otherwise, compose existing components + Tailwind.

---

## 10. Enforcement

- All new code must pass this checklist.
- Use the `/grok-refurb-platform-builder` skill when working in this repo.
- When cleaning legacy code, refer to the Migration Checklist in `design-system.md`.

---

iOS product chrome follows `src/docs/ios-product-design.md`. Branding, plugins, and IA-0 authority are out of scope for that file.
