/**
 * Pure B1B normalisation: unit aliases, string trim, exact decimal policy,
 * snake_case aliases, duplicate detection.
 * No filesystem, network, Supabase, or Node builtins.
 */

import {
  BASE_UNIT_RATE_DECIMAL_STRING_PATTERN,
  MAX_BASE_UNIT_RATE_DECIMAL_PLACES,
  MAX_BASE_UNIT_RATE_INTEGER_DIGITS,
  type DryRunIssue,
  type UnitAliasApplication,
} from "./manifestTypes";
import {
  CANONICAL_MEASURED_BOQ_UNITS,
  UNIT_IMPORT_ALIASES,
  type CanonicalMeasuredBoqUnit,
} from "./constants";
import type { MeasuredBoqCatalogueSourceSnapshot } from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  code: DryRunIssue["code"],
  cls: DryRunIssue["class"],
  path: string,
  message: string,
  extra?: { recordIndex?: number; rateKey?: string },
): DryRunIssue {
  return {
    code,
    class: cls,
    path,
    message,
    ...(extra?.recordIndex !== undefined ? { recordIndex: extra.recordIndex } : {}),
    ...(extra?.rateKey !== undefined ? { rateKey: extra.rateKey } : {}),
  };
}

function pick(obj: Record<string, unknown>, camel: string, snake: string): unknown {
  if (camel in obj) return obj[camel];
  if (snake in obj) return obj[snake];
  return undefined;
}

const SNAPSHOT_KEYS = new Set([
  "schemaVersion",
  "schema_version",
  "catalogRevision",
  "catalog_revision",
  "currency",
  "vatBasis",
  "vat_basis",
  "regionalBasis",
  "regional_basis",
  "effectiveFrom",
  "effective_from",
  "sourceDescription",
  "source_description",
  "entryCount",
  "entry_count",
  "contentChecksum",
  "content_checksum",
  "status",
  "createdBy",
  "created_by",
  "releaseNotes",
  "release_notes",
  "production",
  "entries",
]);

const ENTRY_KEYS = new Set([
  "rateKey",
  "rate_key",
  "displayName",
  "display_name",
  "description",
  "tradeOrDomain",
  "trade_or_domain",
  "trade",
  "unit",
  "costType",
  "cost_type",
  "baseUnitRate",
  "base_unit_rate",
  "currency",
  "vatBasis",
  "vat_basis",
  "sourceReference",
  "source_reference",
  "status",
  "entry_status",
  "replacementRateKey",
  "replacement_rate_key",
]);

/**
 * Canonicalise a baseUnitRate from string or number under numeric(14,4) policy.
 * No silent rounding. Returns canonical decimal text + positive finite number.
 */
export function canonicalizeBaseUnitRate(
  input: unknown,
): { ok: true; text: string; value: number } | { ok: false; message: string } {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed !== input.replace(/^\s+|\s+$/g, "")) {
      // trim already applied; if still has internal issues regex catches
    }
    if (!BASE_UNIT_RATE_DECIMAL_STRING_PATTERN.test(trimmed)) {
      return { ok: false, message: "baseUnitRate decimal string is invalid" };
    }
    const value = Number(trimmed);
    if (!Number.isFinite(value) || !(value > 0) || Object.is(value, -0)) {
      return { ok: false, message: "baseUnitRate must be greater than zero" };
    }
    // Reject zero via pattern-matched "0" / "0.0000" etc.
    if (value <= 0) {
      return { ok: false, message: "baseUnitRate must be greater than zero" };
    }
    return { ok: true, text: trimmed, value };
  }

  if (typeof input === "number") {
    if (!Number.isFinite(input) || !(input > 0) || Object.is(input, -0)) {
      return {
        ok: false,
        message: "baseUnitRate number must be finite and greater than zero",
      };
    }
    const text = numberToExactDecimalText(input);
    if (text == null) {
      return {
        ok: false,
        message:
          "baseUnitRate number is not exactly representable within numeric(14,4) without rounding",
      };
    }
    const value = Number(text);
    if (!Number.isFinite(value) || value !== input) {
      return {
        ok: false,
        message: "baseUnitRate number failed exact round-trip equality",
      };
    }
    return { ok: true, text, value: input };
  }

  return { ok: false, message: "baseUnitRate must be a number or decimal string" };
}

/**
 * Convert a positive finite JS number to an exact decimal string matching
 * BASE_UNIT_RATE_DECIMAL_STRING_PATTERN, or null if not exactly representable
 * within MAX_BASE_UNIT_RATE_DECIMAL_PLACES without rounding.
 *
 * Does not use JSON.stringify alone as precision proof.
 * Does not silently round via toFixed.
 */
export function numberToExactDecimalText(value: number): string | null {
  if (!Number.isFinite(value) || !(value > 0) || Object.is(value, -0)) {
    return null;
  }
  if (value >= 10 ** MAX_BASE_UNIT_RATE_INTEGER_DIGITS) {
    return null;
  }

  // Default string must not require exponent expansion we cannot reverse exactly.
  const defaultStr = String(value);
  if (/[eE]/.test(defaultStr)) {
    // Attempt exact reconstruction only via scaled integer equality below.
  }

  for (let places = 0; places <= MAX_BASE_UNIT_RATE_DECIMAL_PLACES; places++) {
    const factor = 10 ** places;
    const scaled = value * factor;
    const nearest = Math.round(scaled);
    // Exact float equality: value must equal nearest/factor with no residual.
    if (nearest / factor !== value) {
      continue;
    }
    if (nearest <= 0) {
      continue;
    }

    const abs = nearest;
    const intPart = Math.trunc(abs / factor);
    const intStr = String(intPart);
    if (intStr.length > MAX_BASE_UNIT_RATE_INTEGER_DIGITS) {
      continue;
    }
    if (!/^(?:0|[1-9]\d*)$/.test(intStr) && intPart !== 0) {
      continue;
    }
    // Leading zero rule for integer part: "01" not allowed; intPart formatting handles this.
    if (intPart === 0 && places === 0) {
      continue; // zero rate
    }

    let text: string;
    if (places === 0) {
      text = intStr;
    } else {
      const fracNum = abs % factor;
      let frac = String(fracNum).padStart(places, "0");
      // Minimal fractional form (strip trailing zeros) while remaining exact.
      frac = frac.replace(/0+$/, "");
      text = frac.length === 0 ? intStr : `${intStr}.${frac}`;
    }

    if (!BASE_UNIT_RATE_DECIMAL_STRING_PATTERN.test(text)) {
      continue;
    }
    if (Number(text) !== value) {
      continue;
    }
    return text;
  }

  return null;
}

function normaliseUnit(
  rawUnit: unknown,
  path: string,
  issues: DryRunIssue[],
  aliases: UnitAliasApplication[],
  recordIndex: number,
): CanonicalMeasuredBoqUnit | null {
  if (typeof rawUnit !== "string") {
    issues.push(
      issue("UNIT_INVALID", "normalisation", path, "unit must be a string", { recordIndex }),
    );
    return null;
  }
  const trimmed = rawUnit.trim();
  if ((CANONICAL_MEASURED_BOQ_UNITS as readonly string[]).includes(trimmed)) {
    return trimmed as CanonicalMeasuredBoqUnit;
  }
  // Exact alias keys as defined (including m²). Optional ASCII lower only for pure ASCII keys.
  let aliasKey = trimmed;
  const isAscii = [...trimmed].every((ch) => (ch.codePointAt(0) ?? 0) < 128);
  if (isAscii) {
    const lower = trimmed.toLowerCase();
    if (lower in UNIT_IMPORT_ALIASES) {
      aliasKey = lower;
    }
  }
  if (aliasKey in UNIT_IMPORT_ALIASES) {
    const mapped = UNIT_IMPORT_ALIASES[aliasKey]!;
    aliases.push({ path, from: trimmed, to: mapped });
    return mapped;
  }
  // Exact non-ASCII keys (e.g. m²)
  if (trimmed in UNIT_IMPORT_ALIASES) {
    const mapped = UNIT_IMPORT_ALIASES[trimmed]!;
    aliases.push({ path, from: trimmed, to: mapped });
    return mapped;
  }
  issues.push(
    issue("UNIT_INVALID", "normalisation", path, `unknown unit ${trimmed}`, { recordIndex }),
  );
  return null;
}

export type NormaliseCatalogueSnapshotResult =
  | {
      ok: true;
      snapshot: MeasuredBoqCatalogueSourceSnapshot;
      unitAliasApplications: UnitAliasApplication[];
      rateEvidence: Array<{ path: string; text: string; value: number }>;
    }
  | {
      ok: false;
      issues: DryRunIssue[];
      unitAliasApplications: UnitAliasApplication[];
    };

/**
 * Normalise a raw snapshot (object or JSON-decoded) into a form suitable for
 * validateCatalogueSnapshot. Applies B1 trim, unit aliases, decimal policy.
 */
export function normaliseCatalogueSnapshot(
  input: unknown,
  options: {
    strict?: boolean;
    /** Forced production flag from MANIFEST when snapshot omits it. */
    productionFromManifest?: boolean;
  } = {},
): NormaliseCatalogueSnapshotResult {
  const strict = options.strict !== false;
  const issues: DryRunIssue[] = [];
  const unitAliasApplications: UnitAliasApplication[] = [];
  const rateEvidence: Array<{ path: string; text: string; value: number }> = [];

  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: [
        issue("SNAPSHOT_INVALID", "structural", "snapshot", "snapshot must be a non-null object"),
      ],
      unitAliasApplications,
    };
  }

  if (strict) {
    for (const key of Object.keys(input)) {
      if (!SNAPSHOT_KEYS.has(key)) {
        issues.push(
          issue("SNAPSHOT_UNKNOWN_KEY", "structural", `snapshot.${key}`, `unknown key ${key}`),
        );
      }
    }
  }

  const schemaVersion = pick(input, "schemaVersion", "schema_version");
  const catalogRevision = pick(input, "catalogRevision", "catalog_revision");
  const currency = input.currency;
  const vatBasis = pick(input, "vatBasis", "vat_basis");
  const regionalBasis = pick(input, "regionalBasis", "regional_basis");
  const effectiveFrom = pick(input, "effectiveFrom", "effective_from");
  const sourceDescription = pick(input, "sourceDescription", "source_description");
  const contentChecksum = pick(input, "contentChecksum", "content_checksum");
  const status = input.status;
  const createdBy = pick(input, "createdBy", "created_by");
  const releaseNotesVal = pick(input, "releaseNotes", "release_notes");
  const productionRaw =
    input.production !== undefined
      ? input.production
      : options.productionFromManifest !== undefined
        ? options.productionFromManifest
        : undefined;

  const entriesRaw = input.entries;
  if (!Array.isArray(entriesRaw)) {
    issues.push(
      issue("SNAPSHOT_INVALID", "structural", "snapshot.entries", "entries must be an array"),
    );
    return { ok: false, issues, unitAliasApplications };
  }

  const snapCurrency = typeof currency === "string" ? currency : undefined;
  const snapVat = typeof vatBasis === "string" ? vatBasis : undefined;

  const normalisedEntries: Array<Record<string, unknown>> = [];
  const seenRateKeys = new Set<string>();

  for (let i = 0; i < entriesRaw.length; i++) {
    const raw = entriesRaw[i];
    const path = `snapshot.entries[${i}]`;
    if (!isPlainObject(raw)) {
      issues.push(
        issue("SNAPSHOT_INVALID", "structural", path, "entry must be an object", {
          recordIndex: i,
        }),
      );
      continue;
    }

    if (strict) {
      for (const key of Object.keys(raw)) {
        if (!ENTRY_KEYS.has(key)) {
          issues.push(
            issue("ENTRY_UNKNOWN_KEY", "structural", `${path}.${key}`, `unknown key ${key}`, {
              recordIndex: i,
            }),
          );
        }
      }
    }

    const rateKeyRaw = pick(raw, "rateKey", "rate_key");
    const rateKey = typeof rateKeyRaw === "string" ? rateKeyRaw : undefined;
    // Do not case-fold rate keys; validator enforces grammar.
    if (typeof rateKey === "string") {
      if (seenRateKeys.has(rateKey)) {
        issues.push(
          issue(
            "DUPLICATE_RATE_KEY",
            "normalisation",
            `${path}.rateKey`,
            `duplicate rateKey ${rateKey}`,
            {
              recordIndex: i,
              rateKey,
            },
          ),
        );
      } else {
        seenRateKeys.add(rateKey);
      }
    }

    const displayNameRaw = pick(raw, "displayName", "display_name");
    const displayName = typeof displayNameRaw === "string" ? displayNameRaw.trim() : displayNameRaw;

    let description: unknown = raw.description;
    if (typeof description === "string") {
      const t = description.trim();
      description = t === "" ? null : t;
    }

    const tradeRaw =
      pick(raw, "tradeOrDomain", "trade_or_domain") !== undefined
        ? pick(raw, "tradeOrDomain", "trade_or_domain")
        : raw.trade;
    const tradeOrDomain = typeof tradeRaw === "string" ? tradeRaw.trim() : tradeRaw;

    const unit = normaliseUnit(raw.unit, `${path}.unit`, issues, unitAliasApplications, i);

    const costType = pick(raw, "costType", "cost_type");

    const ratePath = `${path}.baseUnitRate`;
    const rateRaw = pick(raw, "baseUnitRate", "base_unit_rate");
    const rate = canonicalizeBaseUnitRate(rateRaw);
    if (!rate.ok) {
      issues.push(
        issue("RATE_INVALID", "normalisation", ratePath, rate.message, {
          recordIndex: i,
          rateKey: typeof rateKey === "string" ? rateKey : undefined,
        }),
      );
    } else {
      rateEvidence.push({ path: ratePath, text: rate.text, value: rate.value });
    }

    const entryCurrency =
      raw.currency !== undefined
        ? raw.currency
        : snapCurrency !== undefined
          ? snapCurrency
          : undefined;
    const entryVat =
      pick(raw, "vatBasis", "vat_basis") !== undefined
        ? pick(raw, "vatBasis", "vat_basis")
        : snapVat !== undefined
          ? snapVat
          : undefined;

    let sourceReference = pick(raw, "sourceReference", "source_reference");
    if (typeof sourceReference === "string") {
      const t = sourceReference.trim();
      sourceReference = t === "" ? null : t;
    }

    const statusVal = pick(raw, "status", "entry_status");
    const replacementRateKey = pick(raw, "replacementRateKey", "replacement_rate_key");

    normalisedEntries.push({
      rateKey,
      displayName,
      description: description === undefined ? null : description,
      tradeOrDomain,
      unit: unit ?? raw.unit,
      costType,
      baseUnitRate: rate.ok ? rate.value : rateRaw,
      currency: entryCurrency,
      vatBasis: entryVat,
      sourceReference: sourceReference === undefined ? null : sourceReference,
      status: statusVal,
      replacementRateKey: replacementRateKey === undefined ? null : replacementRateKey,
    });
  }

  // entryCount default
  let entryCount = pick(input, "entryCount", "entry_count");
  if (entryCount === undefined) {
    entryCount = normalisedEntries.length;
  }

  const schemaVersionNorm =
    typeof schemaVersion === "string" ? schemaVersion.trim() : schemaVersion;
  const sourceDescriptionNorm =
    typeof sourceDescription === "string" ? sourceDescription.trim() : sourceDescription;
  const catalogRevisionNorm =
    typeof catalogRevision === "string" ? catalogRevision : catalogRevision;

  const snapshot: MeasuredBoqCatalogueSourceSnapshot = {
    schemaVersion: schemaVersionNorm,
    catalogRevision: catalogRevisionNorm,
    currency,
    vatBasis,
    regionalBasis,
    effectiveFrom,
    sourceDescription: sourceDescriptionNorm,
    entryCount,
    ...(contentChecksum !== undefined ? { contentChecksum } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(createdBy !== undefined
      ? { createdBy: typeof createdBy === "string" ? createdBy.trim() : createdBy }
      : {}),
    ...(releaseNotesVal !== undefined ? { releaseNotes: releaseNotesVal } : {}),
    ...(productionRaw !== undefined ? { production: productionRaw } : {}),
    entries: normalisedEntries,
  };

  if (issues.length > 0) {
    return { ok: false, issues, unitAliasApplications };
  }

  return { ok: true, snapshot, unitAliasApplications, rateEvidence };
}
