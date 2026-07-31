/**
 * Pure validation for measured-BOQ catalogue source snapshots.
 * No database or React imports.
 */

import {
  CANONICAL_MEASURED_BOQ_UNITS,
  CATALOG_CURRENCIES,
  CATALOG_ENTRY_STATUSES,
  CATALOG_REGIONAL_BASES,
  CATALOG_REVISION_PATTERN,
  CATALOG_REVISION_STATUSES,
  CATALOG_VAT_BASES,
  MAX_CATALOG_ENTRIES,
  MAX_CATALOG_REVISION_LENGTH,
  MAX_CREATED_BY_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_RATE_KEY_LENGTH,
  MAX_RELEASE_NOTES_LENGTH,
  MAX_SCHEMA_VERSION_LENGTH,
  MAX_SOURCE_DESCRIPTION_LENGTH,
  MAX_SOURCE_REFERENCE_LENGTH,
  MAX_TRADE_OR_DOMAIN_LENGTH,
  MEASURED_BOQ_COST_TYPES,
  RATE_KEY_PATTERN,
  type CanonicalMeasuredBoqUnit,
  type MeasuredBoqCatalogueCostType,
} from "./constants";
import { computeSnapshotContentChecksum } from "./checksum";
import type {
  CatalogueEntryStatus,
  CatalogueRevisionStatus,
  CatalogueValidationIssue,
  CatalogueValidationResult,
  MeasuredBoqCatalogueSourceEntry,
  MeasuredBoqCatalogueSourceSnapshot,
  MeasuredBoqCatalogueValidatedEntry,
  MeasuredBoqCatalogueValidatedSnapshot,
} from "./types";

function issue(
  code: CatalogueValidationIssue["code"],
  path: string,
  message: string,
): CatalogueValidationIssue {
  return { code, path, message };
}

function isIsoDateOnly(value: string): boolean {
  if (typeof value !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

function isPositiveFinite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type EntryValidation = {
  issues: CatalogueValidationIssue[];
  entry: MeasuredBoqCatalogueValidatedEntry | null;
};

function validateEntry(raw: unknown, index: number, production: boolean): EntryValidation {
  const path = `entries[${index}]`;
  const issues: CatalogueValidationIssue[] = [];

  if (!isPlainObject(raw)) {
    issues.push(issue("CATALOG_ENTRY_INVALID", path, "entry must be a non-null object"));
    return { issues, entry: null };
  }

  const entry = raw as MeasuredBoqCatalogueSourceEntry;

  let rateKey: string | null = null;
  if (typeof entry.rateKey !== "string" || !RATE_KEY_PATTERN.test(entry.rateKey)) {
    issues.push(
      issue(
        "CATALOG_RATE_KEY_INVALID",
        `${path}.rateKey`,
        "rateKey must match trade.work.unit[.variant] lowercase grammar",
      ),
    );
  } else if (entry.rateKey.length > MAX_RATE_KEY_LENGTH) {
    issues.push(
      issue(
        "CATALOG_RATE_KEY_INVALID",
        `${path}.rateKey`,
        `rateKey exceeds ${MAX_RATE_KEY_LENGTH} characters`,
      ),
    );
  } else {
    rateKey = entry.rateKey;
  }

  let displayName: string | null = null;
  if (
    typeof entry.displayName !== "string" ||
    entry.displayName.trim() === "" ||
    entry.displayName.length > MAX_DISPLAY_NAME_LENGTH
  ) {
    issues.push(
      issue("CATALOG_ENTRY_INVALID", `${path}.displayName`, "displayName is required and bounded"),
    );
  } else {
    displayName = entry.displayName;
  }

  let description: string | null = null;
  if (entry.description != null) {
    if (
      typeof entry.description !== "string" ||
      entry.description.length > MAX_DESCRIPTION_LENGTH
    ) {
      issues.push(
        issue("CATALOG_ENTRY_INVALID", `${path}.description`, "description exceeds bound"),
      );
    } else {
      description = entry.description;
    }
  }

  let tradeOrDomain: string | null = null;
  if (
    typeof entry.tradeOrDomain !== "string" ||
    entry.tradeOrDomain.trim() === "" ||
    entry.tradeOrDomain.length > MAX_TRADE_OR_DOMAIN_LENGTH
  ) {
    issues.push(
      issue(
        "CATALOG_ENTRY_INVALID",
        `${path}.tradeOrDomain`,
        "tradeOrDomain is required and bounded",
      ),
    );
  } else {
    tradeOrDomain = entry.tradeOrDomain;
  }

  let unit: CanonicalMeasuredBoqUnit | null = null;
  if (
    typeof entry.unit !== "string" ||
    !(CANONICAL_MEASURED_BOQ_UNITS as readonly string[]).includes(entry.unit)
  ) {
    issues.push(
      issue(
        "CATALOG_UNIT_INVALID",
        `${path}.unit`,
        `unit must be one of ${CANONICAL_MEASURED_BOQ_UNITS.join(", ")}`,
      ),
    );
  } else {
    unit = entry.unit as CanonicalMeasuredBoqUnit;
  }

  let costType: MeasuredBoqCatalogueCostType | null = null;
  if (
    typeof entry.costType !== "string" ||
    !(MEASURED_BOQ_COST_TYPES as readonly string[]).includes(entry.costType)
  ) {
    issues.push(
      issue(
        "CATALOG_COST_TYPE_INVALID",
        `${path}.costType`,
        `costType must be one of ${MEASURED_BOQ_COST_TYPES.join(", ")}`,
      ),
    );
  } else {
    costType = entry.costType as MeasuredBoqCatalogueCostType;
  }

  let baseUnitRate: number | null = null;
  if (!isPositiveFinite(entry.baseUnitRate)) {
    issues.push(
      issue(
        "CATALOG_RATE_INVALID",
        `${path}.baseUnitRate`,
        "baseUnitRate must be a finite number greater than zero",
      ),
    );
  } else {
    baseUnitRate = entry.baseUnitRate;
  }

  let currency: "GBP" | null = null;
  if (entry.currency !== "GBP") {
    issues.push(issue("CATALOG_CURRENCY_INVALID", `${path}.currency`, "currency must be GBP"));
  } else {
    currency = "GBP";
  }

  let vatBasis: "exclusive" | null = null;
  if (entry.vatBasis !== "exclusive") {
    issues.push(
      issue("CATALOG_VAT_BASIS_INVALID", `${path}.vatBasis`, "vatBasis must be exclusive"),
    );
  } else {
    vatBasis = "exclusive";
  }

  let status: CatalogueEntryStatus | null = null;
  if (
    typeof entry.status !== "string" ||
    !(CATALOG_ENTRY_STATUSES as readonly string[]).includes(entry.status)
  ) {
    issues.push(
      issue("CATALOG_ENTRY_INVALID", `${path}.status`, "status must be active or deprecated"),
    );
  } else {
    status = entry.status as CatalogueEntryStatus;
  }

  let sourceReference: string | null = null;
  if (entry.sourceReference != null) {
    if (
      typeof entry.sourceReference !== "string" ||
      entry.sourceReference.trim() === "" ||
      entry.sourceReference.length > MAX_SOURCE_REFERENCE_LENGTH
    ) {
      issues.push(
        issue(
          "CATALOG_ENTRY_INVALID",
          `${path}.sourceReference`,
          "sourceReference must be non-empty and bounded when present",
        ),
      );
    } else {
      sourceReference = entry.sourceReference;
    }
  } else if (production) {
    issues.push(
      issue(
        "CATALOG_SOURCE_REFERENCE_REQUIRED",
        `${path}.sourceReference`,
        "production catalogue entries require source_reference",
      ),
    );
  }

  let replacementRateKey: string | null = null;
  if (entry.replacementRateKey != null) {
    if (typeof entry.replacementRateKey !== "string") {
      issues.push(
        issue(
          "CATALOG_REPLACEMENT_KEY_INVALID",
          `${path}.replacementRateKey`,
          "replacementRateKey must be a string when present",
        ),
      );
    } else if (entry.replacementRateKey.length > MAX_RATE_KEY_LENGTH) {
      issues.push(
        issue(
          "CATALOG_REPLACEMENT_KEY_INVALID",
          `${path}.replacementRateKey`,
          `replacementRateKey exceeds ${MAX_RATE_KEY_LENGTH} characters`,
        ),
      );
    } else if (!RATE_KEY_PATTERN.test(entry.replacementRateKey)) {
      issues.push(
        issue(
          "CATALOG_RATE_KEY_INVALID",
          `${path}.replacementRateKey`,
          "replacementRateKey must match rate key grammar",
        ),
      );
    } else if (rateKey != null && entry.replacementRateKey === rateKey) {
      issues.push(
        issue(
          "CATALOG_REPLACEMENT_KEY_INVALID",
          `${path}.replacementRateKey`,
          "replacementRateKey must differ from rateKey",
        ),
      );
    } else if (status != null && status !== "deprecated") {
      issues.push(
        issue(
          "CATALOG_REPLACEMENT_KEY_INVALID",
          `${path}.replacementRateKey`,
          "replacementRateKey is only allowed when status is deprecated",
        ),
      );
    } else {
      replacementRateKey = entry.replacementRateKey;
    }
  }

  if (
    issues.length > 0 ||
    rateKey == null ||
    displayName == null ||
    tradeOrDomain == null ||
    unit == null ||
    costType == null ||
    baseUnitRate == null ||
    currency == null ||
    vatBasis == null ||
    status == null
  ) {
    return { issues, entry: null };
  }

  return {
    issues,
    entry: {
      rateKey,
      displayName,
      description,
      tradeOrDomain,
      unit,
      costType,
      baseUnitRate,
      currency,
      vatBasis,
      sourceReference,
      status,
      replacementRateKey,
    },
  };
}

/**
 * Validate a catalogue source snapshot and recompute content checksum.
 * Does not perform database IO or publish.
 * Never throws for malformed entry elements — returns structured issues.
 */
export function validateCatalogueSnapshot(
  snapshot: MeasuredBoqCatalogueSourceSnapshot,
): CatalogueValidationResult {
  const issues: CatalogueValidationIssue[] = [];
  const production = snapshot.production === true;

  let catalogRevision: string | null = null;
  if (
    typeof snapshot.catalogRevision !== "string" ||
    snapshot.catalogRevision.length > MAX_CATALOG_REVISION_LENGTH ||
    !CATALOG_REVISION_PATTERN.test(snapshot.catalogRevision)
  ) {
    issues.push(
      issue(
        "CATALOG_REVISION_INVALID",
        "catalogRevision",
        "catalogRevision must match mboq-YYYY.MM.DD[.N]",
      ),
    );
  } else {
    catalogRevision = snapshot.catalogRevision;
  }

  let schemaVersion: string | null = null;
  if (
    typeof snapshot.schemaVersion !== "string" ||
    snapshot.schemaVersion.trim() === "" ||
    snapshot.schemaVersion.length > MAX_SCHEMA_VERSION_LENGTH
  ) {
    issues.push(
      issue(
        "CATALOG_SCHEMA_VERSION_INVALID",
        "schemaVersion",
        "schemaVersion is required and bounded",
      ),
    );
  } else {
    schemaVersion = snapshot.schemaVersion;
  }

  let currency: "GBP" | null = null;
  if (!(CATALOG_CURRENCIES as readonly string[]).includes(snapshot.currency as string)) {
    issues.push(issue("CATALOG_CURRENCY_INVALID", "currency", "currency must be GBP"));
  } else {
    currency = "GBP";
  }

  let vatBasis: "exclusive" | null = null;
  if (!(CATALOG_VAT_BASES as readonly string[]).includes(snapshot.vatBasis as string)) {
    issues.push(issue("CATALOG_VAT_BASIS_INVALID", "vatBasis", "vatBasis must be exclusive"));
  } else {
    vatBasis = "exclusive";
  }

  let regionalBasis: "uk-region-multipliers-v1" | null = null;
  if (!(CATALOG_REGIONAL_BASES as readonly string[]).includes(snapshot.regionalBasis as string)) {
    issues.push(
      issue(
        "CATALOG_REGIONAL_BASIS_INVALID",
        "regionalBasis",
        "regionalBasis must be uk-region-multipliers-v1",
      ),
    );
  } else {
    regionalBasis = "uk-region-multipliers-v1";
  }

  let effectiveFrom: string | null = null;
  if (typeof snapshot.effectiveFrom !== "string" || !isIsoDateOnly(snapshot.effectiveFrom)) {
    issues.push(
      issue(
        "CATALOG_EFFECTIVE_FROM_INVALID",
        "effectiveFrom",
        "effectiveFrom must be a valid ISO date YYYY-MM-DD",
      ),
    );
  } else {
    effectiveFrom = snapshot.effectiveFrom;
  }

  let sourceDescription: string | null = null;
  if (
    typeof snapshot.sourceDescription !== "string" ||
    snapshot.sourceDescription.trim() === "" ||
    snapshot.sourceDescription.length > MAX_SOURCE_DESCRIPTION_LENGTH
  ) {
    issues.push(
      issue(
        "CATALOG_SOURCE_DESCRIPTION_INVALID",
        "sourceDescription",
        "sourceDescription is required and bounded",
      ),
    );
  } else {
    sourceDescription = snapshot.sourceDescription;
  }

  let status: CatalogueRevisionStatus | undefined;
  if (snapshot.status != null) {
    if (
      typeof snapshot.status !== "string" ||
      !(CATALOG_REVISION_STATUSES as readonly string[]).includes(snapshot.status)
    ) {
      issues.push(
        issue(
          "CATALOG_STATUS_INVALID",
          "status",
          "status must be draft, published, or retired when present",
        ),
      );
    } else {
      status = snapshot.status as CatalogueRevisionStatus;
    }
  }

  let createdBy: string | undefined;
  if (snapshot.createdBy != null) {
    if (
      typeof snapshot.createdBy !== "string" ||
      snapshot.createdBy.trim() === "" ||
      snapshot.createdBy.length > MAX_CREATED_BY_LENGTH
    ) {
      issues.push(
        issue("CATALOG_ENTRY_INVALID", "createdBy", "createdBy must be non-empty and bounded"),
      );
    } else {
      createdBy = snapshot.createdBy;
    }
  }

  let releaseNotes: string | null | undefined;
  if (snapshot.releaseNotes != null) {
    if (
      typeof snapshot.releaseNotes !== "string" ||
      snapshot.releaseNotes.length > MAX_RELEASE_NOTES_LENGTH
    ) {
      issues.push(issue("CATALOG_ENTRY_INVALID", "releaseNotes", "releaseNotes exceeds bound"));
    } else {
      releaseNotes = snapshot.releaseNotes;
    }
  } else {
    releaseNotes = snapshot.releaseNotes === null ? null : undefined;
  }

  if (!Array.isArray(snapshot.entries)) {
    issues.push(issue("CATALOG_ENTRY_INVALID", "entries", "entries must be an array"));
    return { ok: false, issues };
  }

  if (snapshot.entries.length > MAX_CATALOG_ENTRIES) {
    issues.push(
      issue("CATALOG_TOO_LARGE", "entries", `entries exceed maximum of ${MAX_CATALOG_ENTRIES}`),
    );
  }

  const entryCount =
    typeof snapshot.entryCount === "number" && Number.isInteger(snapshot.entryCount)
      ? snapshot.entryCount
      : null;
  if (entryCount == null) {
    issues.push(
      issue("CATALOG_ENTRY_COUNT_MISMATCH", "entryCount", "entryCount must be an integer"),
    );
  } else if (entryCount !== snapshot.entries.length) {
    issues.push(
      issue(
        "CATALOG_ENTRY_COUNT_MISMATCH",
        "entryCount",
        `entryCount ${entryCount} does not match entries.length ${snapshot.entries.length}`,
      ),
    );
  }

  const seen = new Set<string>();
  const validatedEntries: MeasuredBoqCatalogueValidatedEntry[] = [];

  for (let i = 0; i < snapshot.entries.length; i++) {
    const { issues: entryIssues, entry } = validateEntry(snapshot.entries[i], i, production);
    issues.push(...entryIssues);
    if (entry) {
      if (seen.has(entry.rateKey)) {
        issues.push(
          issue(
            "CATALOG_DUPLICATE_RATE_KEY",
            `entries[${i}].rateKey`,
            `duplicate rateKey ${entry.rateKey}`,
          ),
        );
      } else {
        seen.add(entry.rateKey);
      }
      validatedEntries.push(entry);
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  if (
    catalogRevision == null ||
    schemaVersion == null ||
    currency == null ||
    vatBasis == null ||
    regionalBasis == null ||
    effectiveFrom == null ||
    sourceDescription == null ||
    entryCount == null
  ) {
    return { ok: false, issues: [issue("CATALOG_ENTRY_INVALID", "", "internal validation gap")] };
  }

  const narrowed: MeasuredBoqCatalogueValidatedSnapshot = {
    schemaVersion,
    catalogRevision,
    currency,
    vatBasis,
    regionalBasis,
    effectiveFrom,
    sourceDescription,
    entryCount,
    status,
    createdBy,
    releaseNotes,
    production,
    entries: validatedEntries,
  };

  const contentChecksum = computeSnapshotContentChecksum(narrowed);

  if (
    snapshot.contentChecksum != null &&
    typeof snapshot.contentChecksum === "string" &&
    snapshot.contentChecksum !== contentChecksum
  ) {
    return {
      ok: false,
      issues: [
        issue(
          "CATALOG_CHECKSUM_MISMATCH",
          "contentChecksum",
          "provided contentChecksum does not match recomputed digest",
        ),
      ],
    };
  }

  return {
    ok: true,
    snapshot: {
      ...narrowed,
      contentChecksum:
        typeof snapshot.contentChecksum === "string" ? snapshot.contentChecksum : undefined,
    },
    contentChecksum,
  };
}
