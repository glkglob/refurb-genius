/**
 * Pure measured-BOQ catalogue source contract types (no database IO).
 *
 * Values in this contract are not production prices unless published under
 * the data-acquisition / licence gate. Synthetic fixtures are test-only.
 */

import type { CanonicalMeasuredBoqUnit, MeasuredBoqCatalogueCostType } from "./constants";

export type CatalogueRevisionStatus = "draft" | "published" | "retired";
export type CatalogueEntryStatus = "active" | "deprecated";

/** Untrusted external/source entry — all fields may be wrong types. */
export type MeasuredBoqCatalogueSourceEntry = {
  rateKey?: unknown;
  displayName?: unknown;
  description?: unknown;
  tradeOrDomain?: unknown;
  unit?: unknown;
  costType?: unknown;
  baseUnitRate?: unknown;
  currency?: unknown;
  vatBasis?: unknown;
  sourceReference?: unknown;
  status?: unknown;
  replacementRateKey?: unknown;
};

/** Untrusted external/source snapshot. */
export type MeasuredBoqCatalogueSourceSnapshot = {
  schemaVersion?: unknown;
  catalogRevision?: unknown;
  currency?: unknown;
  vatBasis?: unknown;
  regionalBasis?: unknown;
  effectiveFrom?: unknown;
  sourceDescription?: unknown;
  entryCount?: unknown;
  contentChecksum?: unknown;
  status?: unknown;
  createdBy?: unknown;
  releaseNotes?: unknown;
  /** When true, production publish requires non-empty source_reference on every entry. */
  production?: unknown;
  entries?: unknown;
};

/** Narrowed validated entry after successful validateCatalogueSnapshot. */
export type MeasuredBoqCatalogueValidatedEntry = {
  rateKey: string;
  displayName: string;
  description: string | null;
  tradeOrDomain: string;
  unit: CanonicalMeasuredBoqUnit;
  costType: MeasuredBoqCatalogueCostType;
  baseUnitRate: number;
  currency: "GBP";
  vatBasis: "exclusive";
  sourceReference: string | null;
  status: CatalogueEntryStatus;
  replacementRateKey: string | null;
};

/** Narrowed validated snapshot after successful validateCatalogueSnapshot. */
export type MeasuredBoqCatalogueValidatedSnapshot = {
  schemaVersion: string;
  catalogRevision: string;
  currency: "GBP";
  vatBasis: "exclusive";
  regionalBasis: "uk-region-multipliers-v1";
  effectiveFrom: string;
  sourceDescription: string;
  entryCount: number;
  contentChecksum?: string;
  status?: CatalogueRevisionStatus;
  createdBy?: string;
  releaseNotes?: string | null;
  production?: boolean;
  entries: MeasuredBoqCatalogueValidatedEntry[];
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
  | "CATALOG_SOURCE_DESCRIPTION_INVALID"
  | "CATALOG_REPLACEMENT_KEY_INVALID";

export type CatalogueValidationIssue = {
  code: CatalogueValidationCode;
  path: string;
  message: string;
};

export type CatalogueValidationResult =
  | {
      ok: true;
      snapshot: MeasuredBoqCatalogueValidatedSnapshot;
      contentChecksum: string;
    }
  | { ok: false; issues: CatalogueValidationIssue[] };
