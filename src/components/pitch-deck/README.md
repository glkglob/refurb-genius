# Pitch Deck Generator

## Usage

```tsx
import { PitchDeckGenerator } from "@/components/pitch-deck";

// In Property Detail header actions (already wired)
<PitchDeckGenerator projectId={id} project={project} trigger="header" />

// In Financials tab or elsewhere
<PitchDeckGenerator projectId={id} project={project} trigger="financials" />
```

- One click: fetches live data via existing query layer (project, financials, estimate, photos, analyses).
- Generates professional multi-page PDF (jsPDF + autotable) with sections for summary, financials/ROI, estimate, floorplan notes, highlights.
- Downloads immediately.
- Optionally uploads PDF to `pitch-decks` private bucket and records in `pitch_deck_exports` (invalidates query history).
- Progress indication + Sonner toasts.
- Branded header/footer, investor-ready layout.

Data for charts/photos/floorplans pulled from queries; full visual embeds (Recharts screenshots) can be added by passing canvas dataURLs in future.

Follows all patterns: no direct console, logger, @repo/ui, RLS via client, etc.
