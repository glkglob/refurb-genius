/**
 * Pure B1B measured-BOQ catalogue manifest and dry-run report types.
 * No filesystem, network, Supabase, or Node builtins.
 */

export const B1_MANIFEST_VERSION = "1" as const;
export const B1_NORMALISER_VERSION = "1" as const;
export const B1_TRANSFORMATION_SCHEMA_VERSION = "1" as const;

export const MAX_BASE_UNIT_RATE_INTEGER_DIGITS = 10;
export const MAX_BASE_UNIT_RATE_DECIMAL_PLACES = 4;

/** Decimal string grammar for baseUnitRate after trim (numeric(14,4)). */
export const BASE_UNIT_RATE_DECIMAL_STRING_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,4})?$/;

export const B1_LICENCE_STATUSES = ["synthetic", "rights_unverified"] as const;
export type B1LicenceStatus = (typeof B1_LICENCE_STATUSES)[number];

export const DRY_RUN_ISSUE_CLASSES = [
  "structural",
  "normalisation",
  "semantic",
  "policy",
  "checksum",
  "unsupported",
] as const;
export type DryRunIssueClass = (typeof DRY_RUN_ISSUE_CLASSES)[number];

export type DryRunIssueCode =
  | "MANIFEST_VERSION_UNSUPPORTED"
  | "NORMALISER_VERSION_UNSUPPORTED"
  | "MANIFEST_INVALID"
  | "MANIFEST_UNKNOWN_KEY"
  | "MANIFEST_FIELD_INVALID"
  | "LICENCE_STATUS_INVALID"
  | "PRODUCTION_BLOCKED"
  | "JSON_PARSE_INVALID"
  | "SNAPSHOT_INVALID"
  | "SNAPSHOT_UNKNOWN_KEY"
  | "ENTRY_UNKNOWN_KEY"
  | "AMBIGUOUS_FIELD_ALIAS"
  | "RATE_INVALID"
  | "UNIT_INVALID"
  | "DUPLICATE_RATE_KEY"
  | "REVISION_MISMATCH"
  | "INPUT_CHECKSUM_MISMATCH"
  | "OUTPUT_CHECKSUM_MISMATCH"
  | "CATALOGUE_VALIDATION_FAILED";

export type DryRunIssue = {
  code: DryRunIssueCode | string;
  class: DryRunIssueClass;
  path: string;
  recordIndex?: number;
  rateKey?: string;
  message: string;
};

export type UnitAliasApplication = {
  path: string;
  from: string;
  to: string;
};

export type CatalogueManifestSource = {
  id: string;
  name: string;
  version: string;
  effectiveDate: string;
  retrievedAt?: string;
  licenceReference: string;
  licenceStatus: B1LicenceStatus;
};

export type CatalogueManifestTransformation = {
  schemaVersion: string;
  normaliserVersion: string;
};

export type CatalogueManifestPackage = {
  snapshotPath: string;
  production: boolean;
};

/** Parsed, canonical manifest (camelCase internal form). */
export type CatalogueManifest = {
  manifestVersion: string;
  catalogRevision: string;
  source: CatalogueManifestSource;
  transformation: CatalogueManifestTransformation;
  package: CatalogueManifestPackage;
};

export type CatalogueDryRunReport = {
  ok: boolean;
  mode: "dry-run";
  tool: "catalogue-dry-run";
  manifestVersion: string | null;
  normaliserVersion: string | null;
  catalogRevision: string | null;
  sourceId: string | null;
  licenceStatus: B1LicenceStatus | null;
  production: boolean | null;
  recordCount: number;
  acceptedCount: number;
  rejectedCount: number;
  warningCount: number;
  inputChecksum: string;
  outputChecksum: string | null;
  unitAliasApplications: UnitAliasApplication[];
  issues: DryRunIssue[];
  warnings: DryRunIssue[];
};

export type RunCatalogueDryRunInput = {
  /** Raw MANIFEST.json text (UTF-8). */
  manifestText: string;
  /** Raw snapshot.json text (UTF-8). */
  snapshotText: string;
  expectedInputChecksum?: string;
  expectedOutputChecksum?: string;
};

export type RunCatalogueDryRunResult = {
  report: CatalogueDryRunReport;
  /** Present only when catalogue validation succeeded. */
  contentChecksum?: string;
  /**
   * Present only when catalogue validation succeeded.
   * Server-owned validated snapshot for trusted persistence (B2D).
   */
  validatedSnapshot?: import("./types").MeasuredBoqCatalogueValidatedSnapshot;
};
