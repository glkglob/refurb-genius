/**
 * Pure measured-BOQ catalogue application helpers.
 * Re-exports services catalogue validation and mixed-revision gate.
 * No database IO.
 */

export {
  assertSingleCatalogRevision,
  validateCatalogueSnapshot,
  computeCatalogueContentChecksum,
  computeSnapshotContentChecksum,
  canonicalCatalogueSerialisation,
  MAX_CATALOG_REVISION_LENGTH,
  MAX_RATE_KEY_LENGTH,
  MAX_CATALOG_ENTRIES,
  CANONICAL_MEASURED_BOQ_UNITS,
  MEASURED_BOQ_COST_TYPES,
  CATALOG_REVISION_PATTERN,
  RATE_KEY_PATTERN,
  type MixedCatalogRevisionResult,
  type MeasuredBoqCatalogueSourceSnapshot,
  type MeasuredBoqCatalogueSourceEntry,
  type CatalogueValidationResult,
  type CatalogueValidationIssue,
  type CatalogueValidationCode,
} from "@repo/services";
