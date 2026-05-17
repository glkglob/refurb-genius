Replace the browser print-to-PDF workaround with a proper named PDF download on the investor report page.

## Context

The report page is `src/routes/projects.$id.report.tsx`.

Currently both the "Print" and "Export PDF" buttons call `window.print()`. The toolbar is:

```tsx
<Button variant="outline" size="sm" onClick={() => window.print()}>
  <Printer className="h-4 w-4" /> Print
</Button>
<Button size="sm" onClick={() => window.print()}>
  <Download className="h-4 w-4" /> Export PDF
</Button>
```

The print stylesheet class `no-print` hides the toolbar, and `print-area` wraps the report content — these are defined in `src/styles.css`.

## What to build

Use the browser's native `window.print()` with a programmatic filename via a hidden `<iframe>` approach, OR use the `@react-pdf/renderer` library.

**Preferred approach: `@react-pdf/renderer`** — generates a real downloadable `.pdf` file with the project name in the filename (e.g. `refurb-genius-14-baker-street-report.pdf`).

### Step 1 — Install the library

```bash
npm install @react-pdf/renderer
npm install --save-dev @types/react-pdf
```

Note: `@react-pdf/renderer` has its own React renderer — do NOT mix its components with the DOM React tree. It must be rendered in a separate async function.

### Step 2 — Create a PDF document component

Create `src/components/ReportPdf.tsx`.

It must accept the same props the report page already assembles:

- `project: Project` (from `src/core/projects`)
- `analysis: RoomAnalysis[]` (from `src/core/ai`)
- `estimate: PersistedProjectEstimate | null` (from `src/lib/estimates`)
- `report: ReturnType<typeof buildReport>` (from `src/core/reports`)

Use `@react-pdf/renderer` Document/Page/View/Text/StyleSheet components to lay out:

- Cover: project name, address, date
- Executive summary text
- Estimate table (category, labour, materials, total)
- Totals (subtotal, contingency, VAT, total)
- ROI metrics (purchase price, GDV, profit, ROI %, yield, score)
- Room condition list (room type, condition, key issues)

Keep styling simple — black text on white, navy headings. No images needed.

### Step 3 — Wire the download button

In `src/routes/projects.$id.report.tsx`:

1. Add a `pdfLoading` state: `const [pdfLoading, setPdfLoading] = useState(false)`
2. Add a `handleExportPdf` async function:
   - Set `pdfLoading = true`
   - Dynamically import `{ pdf }` from `@react-pdf/renderer` and `ReportPdf` from `@/components/ReportPdf`
   - Call `const blob = await pdf(<ReportPdf project={project} analysis={analysis} estimate={savedEstimate} report={report} />).toBlob()`
   - Create an object URL, trigger a download with a filename like `refurb-genius-${project.name.toLowerCase().replace(/\s+/g, "-")}-report.pdf`
   - Revoke the object URL
   - Set `pdfLoading = false`
3. Update the "Export PDF" button to call `handleExportPdf` and show a `<Loader2>` spinner while `pdfLoading` is true
4. Leave the "Print" button calling `window.print()` unchanged

### Step 4 — Keep print styles working

The `no-print` / `print-area` CSS classes in `src/styles.css` must remain — the Print button still uses `window.print()`.

## Rules

- Only change `src/routes/projects.$id.report.tsx` and create `src/components/ReportPdf.tsx`
- Do NOT alter any other route or component
- Do NOT alter the pricing/ROI engines or report builder
- The PDF must use data already assembled on the page — no new Supabase queries
- Run `npx tsc --noEmit` — must pass with zero errors
- Run `npm run format` before committing
- Commit: `feat: add native PDF export to investor report`
