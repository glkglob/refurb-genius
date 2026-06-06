// App-level type barrel (for feature-specific or query result extensions).
// Prefer @repo/types for canonical domain types.
// Re-export new foundation types for convenience in queries/components.

export type {
  FloorplanModel,
  FloorplanAnnotation,
  FloorplanMeasurement,
  FloorplanModelWithAnnotations,
  FloorplanStatus,
  Tradeperson,
  TradeSpecialty,
  TradeFavorite,
  QuoteRequest,
  TradeMessage,
  TradepersonWithSpecialties,
  QuoteRequestWithMessages,
  QuoteStatus,
  PhotoAnalysisResult,
  PitchDeckExport,
  PublicGalleryProject,
  InvestorLead,
  GalleryProjectWithLeads,
} from "@repo/types";

// Any app-only extensions can live here (e.g. UI view models)
export type { Financials } from "@/lib/queries/projects";
