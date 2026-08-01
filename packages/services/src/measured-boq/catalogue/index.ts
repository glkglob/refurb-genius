export {
  MAX_CATALOG_REVISION_LENGTH,
  MAX_RATE_KEY_LENGTH,
  MAX_CATALOG_ENTRIES,
  CANONICAL_MEASURED_BOQ_UNITS,
  MEASURED_BOQ_COST_TYPES,
  CATALOG_REVISION_PATTERN,
  RATE_KEY_PATTERN,
  UNIT_IMPORT_ALIASES,
  CATALOG_CURRENCIES,
  CATALOG_VAT_BASES,
  CATALOG_REGIONAL_BASES,
  CATALOG_REVISION_STATUSES,
  CATALOG_ENTRY_STATUSES,
  type CanonicalMeasuredBoqUnit,
  type MeasuredBoqCatalogueCostType,
} from "./constants";

export {
  computeCatalogueContentChecksum,
  computeSnapshotContentChecksum,
  canonicalCatalogueSerialisation,
  type CanonicalCatalogueChecksumInput,
} from "./checksum";

export { validateCatalogueSnapshot } from "./validateCatalogueSnapshot";

export {
  assertSingleCatalogRevision,
  type MixedCatalogRevisionResult,
} from "./assertSingleCatalogRevision";

export type {
  MeasuredBoqCatalogueSourceEntry,
  MeasuredBoqCatalogueSourceSnapshot,
  MeasuredBoqCatalogueValidatedEntry,
  MeasuredBoqCatalogueValidatedSnapshot,
  CatalogueValidationCode,
  CatalogueValidationIssue,
  CatalogueValidationResult,
  CatalogueRevisionStatus,
  CatalogueEntryStatus,
} from "./types";

export { sha256Hex, utf8BytesFallback, writeSha256BitLength } from "./sha256";

/** B1B pure manifest / dry-run pipeline (no filesystem or CLI). */
export {
  B1_MANIFEST_VERSION,
  B1_NORMALISER_VERSION,
  B1_TRANSFORMATION_SCHEMA_VERSION,
  MAX_BASE_UNIT_RATE_INTEGER_DIGITS,
  MAX_BASE_UNIT_RATE_DECIMAL_PLACES,
  BASE_UNIT_RATE_DECIMAL_STRING_PATTERN,
  B1_LICENCE_STATUSES,
  DRY_RUN_ISSUE_CLASSES,
  type B1LicenceStatus,
  type DryRunIssueClass,
  type DryRunIssueCode,
  type DryRunIssue,
  type UnitAliasApplication,
  type CatalogueManifestSource,
  type CatalogueManifestTransformation,
  type CatalogueManifestPackage,
  type CatalogueManifest,
  type CatalogueDryRunReport,
  type RunCatalogueDryRunInput,
  type RunCatalogueDryRunResult,
} from "./manifestTypes";

export { computePackageArtifactChecksum, PACKAGE_ARTIFACT_DOMAIN } from "./packageChecksum";

export {
  parseCatalogueManifest,
  type ParseCatalogueManifestResult,
} from "./parseCatalogueManifest";

export {
  canonicalizeBaseUnitRate,
  numberToExactDecimalText,
  normaliseCatalogueSnapshot,
  type NormaliseCatalogueSnapshotResult,
} from "./normaliseCatalogueSnapshot";

export { runCatalogueDryRun } from "./runCatalogueDryRun";
