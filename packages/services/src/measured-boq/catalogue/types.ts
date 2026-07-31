/**
 * Pure measured-BOQ catalogue source contract types (no database IO).
 *
 * Values in this contract are not production prices unless published under
 * the data-acquisition / licence gate. Synthetic fixtures are test-only.
 */

import type { CanonicalMeasuredBoqUnit, MeasuredBoqCatalogueCostType } from "./constants";

export type CatalogueRevisionStatus = "draft" | "published" | "retired";
export type CatalogueEntryStatus = "active" | "deprecated";

export type MeasuredBoqCatalogueSourceEntry = {
  rateKey: string;
  displayName: string;
  description?: string | null;
  tradeOrDomain: string;
  unit: CanonicalMeasuredBoqUnit | string;
  costType: MeasuredBoqCatalogueCostType | string;
  baseUnitRate: number;
  currency: "GBP" | string;
  vatBasis: "exclusive" | string;
  sourceReference?: string | null;
  status: CatalogueEntryStatus | string;
  replacementRateKey?: string | null;
};

export type MeasuredBoqCatalogueSourceSnapshot = {
  schemaVersion: string;
  catalogRevision: string;
  currency: "GBP" | string;
  vatBasis: "exclusive" | string;
  regionalBasis: "uk-region-multipliers-v1" | string;
  effectiveFrom: string; // YYYY-MM-DD
  sourceDescription: string;
  entryCount: number;
  contentChecksum?: string;
  status?: CatalogueRevisionStatus | string;
  createdBy?: string;
  releaseNotes?: string | null;
  /** When true, production publish requires non-empty source_reference on every entry. */
  production?: boolean;
  entries: MeasuredBoqCatalogueSourceEntry[];
};

export type CatalogueValidationCode =
  | "CATALOG_REVISION_INVALID"
  | "CATALOG_REVISION_NOT_FOUND"
  | "CATALOG_REVISION_NOT_PUBLISHED"
  | "CATALOG_CHECKSUM_MISMATCH"
  | "CATALOG_ENTRY_COUNT_MISMATCH"
  | "CATALOG_ENTRY_INVALID"
  | "CATALOG_DUPLICATE_RATE_KEY"
  | "CATALOG_RATE_KEY_INVALID"
  | "CATALOG_UNIT_INVALID"
  | "CATALOG_COST_TYPE_INVALID"
  | "CATALOG_RATE_INVALID"
  | "CATALOG_SOURCE_REFERENCE_REQUIRED"
  | "CATALOG_TOO_LARGE"
  | "CATALOG_STATUS_INVALID"
  | "CATALOG_CURRENCY_INVALID"
  | "CATALOG_VAT_BASIS_INVALID"
  | "CATALOG_REGIONAL_BASIS_INVALID"
  | "CATALOG_SCHEMA_VERSION_INVALID"
  | "CATALOG_EFFECTIVE_FROM_INVALID"
  | "CATALOG_SOURCE_DESCRIPTION_INVALID";

export type CatalogueValidationIssue = {
  code: CatalogueValidationCode;
  path: string;
  message: string;
};

export type CatalogueValidationResult =
  | { ok: true; snapshot: MeasuredBoqCatalogueSourceSnapshot; contentChecksum: string }
  | { ok: false; issues: CatalogueValidationIssue[] };
