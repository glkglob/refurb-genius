Fix the 7 ESLint fast-refresh warnings in the shadcn/ui component files.

## Context

Running `npm run lint` produces 7 warnings like:

```
Fast refresh only works when a file only exports components.
Use a new file to share constants or functions between components.
react-refresh/only-export-components
```

The affected files are all generated shadcn/ui components:

- `src/components/ui/badge.tsx` — exports `badgeVariants` (a `cva` variant function) alongside `Badge`
- `src/components/ui/button.tsx` — exports `buttonVariants` alongside `Button`
- `src/components/ui/form.tsx` — exports `FormField`, `FormItem`, etc. plus hook-like helpers
- `src/components/ui/navigation-menu.tsx` — exports `navigationMenuTriggerStyle` alongside components
- `src/components/ui/sidebar.tsx` — exports `SIDEBAR_WIDTH` and other constants alongside components
- `src/components/ui/toggle.tsx` — exports `toggleVariants` alongside `Toggle`

## The right fix

These are generated library files. The correct approach is to suppress the warning inline with `// eslint-disable-next-line` on the specific export lines — NOT to restructure the files (that would break all importers and diverge from the shadcn/ui upstream).

For each file:

1. Read the file
2. Find the non-component export(s) that trigger the warning (variant functions, constants, style helpers)
3. Add `// eslint-disable-next-line react-refresh/only-export-components` on the line immediately above each offending export

Do this for all 6 files.

After editing, run `npm run lint` and confirm the warning count drops to 0.

## Important

- Do NOT restructure the files or move exports to new files
- Do NOT change any component logic
- Do NOT suppress the entire file — only the specific lines that cause warnings
- These files may have been auto-formatted already — preserve existing formatting
- Run `npx tsc --noEmit` after — must still pass with zero errors
- Run `npm run format` before committing
- Commit: `fix: suppress fast-refresh ESLint warnings in shadcn/ui variant exports`
