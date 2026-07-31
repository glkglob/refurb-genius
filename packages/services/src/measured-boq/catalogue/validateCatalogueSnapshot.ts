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
} from "./constants";
import { computeSnapshotContentChecksum } from "./checksum";
import type {
  CatalogueValidationIssue,
  CatalogueValidationResult,
  MeasuredBoqCatalogueSourceEntry,
  MeasuredBoqCatalogueSourceSnapshot,
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

function validateEntry(
  entry: MeasuredBoqCatalogueSourceEntry,
  index: number,
  production: boolean,
): CatalogueValidationIssue[] {
  const path = `entries[${index}]`;
  const issues: CatalogueValidationIssue[] = [];

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
  }

  if (
    typeof entry.displayName !== "string" ||
    entry.displayName.trim() === "" ||
    entry.displayName.length > MAX_DISPLAY_NAME_LENGTH
  ) {
    issues.push(
      issue("CATALOG_ENTRY_INVALID", `${path}.displayName`, "displayName is required and bounded"),
    );
  }

  if (
    entry.description != null &&
    (typeof entry.description !== "string" || entry.description.length > MAX_DESCRIPTION_LENGTH)
  ) {
    issues.push(issue("CATALOG_ENTRY_INVALID", `${path}.description`, "description exceeds bound"));
  }

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
  }

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
  }

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
  }

  if (!isPositiveFinite(entry.baseUnitRate)) {
    issues.push(
      issue(
        "CATALOG_RATE_INVALID",
        `${path}.baseUnitRate`,
        "baseUnitRate must be a finite number greater than zero",
      ),
    );
  }

  if (entry.currency !== "GBP") {
    issues.push(issue("CATALOG_CURRENCY_INVALID", `${path}.currency`, "currency must be GBP"));
  }
  if (entry.vatBasis !== "exclusive") {
    issues.push(
      issue("CATALOG_VAT_BASIS_INVALID", `${path}.vatBasis`, "vatBasis must be exclusive"),
    );
  }

  if (
    typeof entry.status !== "string" ||
    !(CATALOG_ENTRY_STATUSES as readonly string[]).includes(entry.status)
  ) {
    issues.push(
      issue("CATALOG_ENTRY_INVALID", `${path}.status`, "status must be active or deprecated"),
    );
  }

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

  if (entry.replacementRateKey != null) {
    if (
      typeof entry.replacementRateKey !== "string" ||
      !RATE_KEY_PATTERN.test(entry.replacementRateKey) ||
      entry.replacementRateKey === entry.rateKey
    ) {
      issues.push(
        issue(
          "CATALOG_RATE_KEY_INVALID",
          `${path}.replacementRateKey`,
          "replacementRateKey must be a valid key different from rateKey",
        ),
      );
    }
  }

  return issues;
}

/**
 * Validate a catalogue source snapshot and recompute content checksum.
 * Does not perform database IO or publish.
 */
export function validateCatalogueSnapshot(
  snapshot: MeasuredBoqCatalogueSourceSnapshot,
): CatalogueValidationResult {
  const issues: CatalogueValidationIssue[] = [];
  const production = snapshot.production === true;

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
  }

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
  }

  if (!(CATALOG_CURRENCIES as readonly string[]).includes(snapshot.currency)) {
    issues.push(issue("CATALOG_CURRENCY_INVALID", "currency", "currency must be GBP"));
  }
  if (!(CATALOG_VAT_BASES as readonly string[]).includes(snapshot.vatBasis)) {
    issues.push(issue("CATALOG_VAT_BASIS_INVALID", "vatBasis", "vatBasis must be exclusive"));
  }
  if (!(CATALOG_REGIONAL_BASES as readonly string[]).includes(snapshot.regionalBasis)) {
    issues.push(
      issue(
        "CATALOG_REGIONAL_BASIS_INVALID",
        "regionalBasis",
        "regionalBasis must be uk-region-multipliers-v1",
      ),
    );
  }

  if (!isIsoDateOnly(snapshot.effectiveFrom)) {
    issues.push(
      issue(
        "CATALOG_EFFECTIVE_FROM_INVALID",
        "effectiveFrom",
        "effectiveFrom must be a valid ISO date YYYY-MM-DD",
      ),
    );
  }

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
  }

  if (
    snapshot.status != null &&
    !(CATALOG_REVISION_STATUSES as readonly string[]).includes(snapshot.status)
  ) {
    issues.push(
      issue(
        "CATALOG_STATUS_INVALID",
        "status",
        "status must be draft, published, or retired when present",
      ),
    );
  }

  if (
    snapshot.createdBy != null &&
    (typeof snapshot.createdBy !== "string" ||
      snapshot.createdBy.trim() === "" ||
      snapshot.createdBy.length > MAX_CREATED_BY_LENGTH)
  ) {
    issues.push(
      issue("CATALOG_ENTRY_INVALID", "createdBy", "createdBy must be non-empty and bounded"),
    );
  }

  if (
    snapshot.releaseNotes != null &&
    (typeof snapshot.releaseNotes !== "string" ||
      snapshot.releaseNotes.length > MAX_RELEASE_NOTES_LENGTH)
  ) {
    issues.push(issue("CATALOG_ENTRY_INVALID", "releaseNotes", "releaseNotes exceeds bound"));
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

  if (snapshot.entryCount !== snapshot.entries.length) {
    issues.push(
      issue(
        "CATALOG_ENTRY_COUNT_MISMATCH",
        "entryCount",
        `entryCount ${snapshot.entryCount} does not match entries.length ${snapshot.entries.length}`,
      ),
    );
  }

  const seen = new Set<string>();
  for (let i = 0; i < snapshot.entries.length; i++) {
    const entry = snapshot.entries[i]!;
    if (typeof entry.rateKey === "string") {
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
    }
    issues.push(...validateEntry(entry, i, production));
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const contentChecksum = computeSnapshotContentChecksum(snapshot);

  if (snapshot.contentChecksum != null && snapshot.contentChecksum !== contentChecksum) {
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
    snapshot,
    contentChecksum,
  };
}
