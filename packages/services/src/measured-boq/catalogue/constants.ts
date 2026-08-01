/**
 * Measured-BOQ catalogue validation constants (pure, no IO).
 *
 * Synthetic fixtures may reuse these constraints. Production publication
 * additionally requires lawful source_reference and governance approval.
 */

export const MAX_CATALOG_REVISION_LENGTH = 64;
export const MAX_RATE_KEY_LENGTH = 160;
export const MAX_CATALOG_ENTRIES = 50_000;
export const MAX_DISPLAY_NAME_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_TRADE_OR_DOMAIN_LENGTH = 100;
export const MAX_SOURCE_REFERENCE_LENGTH = 500;
export const MAX_SOURCE_DESCRIPTION_LENGTH = 1000;
export const MAX_SCHEMA_VERSION_LENGTH = 64;
export const MAX_RELEASE_NOTES_LENGTH = 4000;
export const MAX_CREATED_BY_LENGTH = 200;

/** Grammar: mboq-YYYY.MM.DD or mboq-YYYY.MM.DD.N */
export const CATALOG_REVISION_PATTERN = /^mboq-[0-9]{4}\.[0-9]{2}\.[0-9]{2}(\.[0-9]+)?$/;

/** At least three lowercase segments separated by dots. */
export const RATE_KEY_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+){2,}$/;

export const CANONICAL_MEASURED_BOQ_UNITS = ["m2", "m", "item", "hr", "day"] as const;
export type CanonicalMeasuredBoqUnit = (typeof CANONICAL_MEASURED_BOQ_UNITS)[number];

export const MEASURED_BOQ_COST_TYPES = ["labour", "materials", "combined"] as const;
export type MeasuredBoqCatalogueCostType = (typeof MEASURED_BOQ_COST_TYPES)[number];

export const CATALOG_CURRENCIES = ["GBP"] as const;
export const CATALOG_VAT_BASES = ["exclusive"] as const;
export const CATALOG_REGIONAL_BASES = ["uk-region-multipliers-v1"] as const;

export const CATALOG_REVISION_STATUSES = ["draft", "published", "retired"] as const;
export const CATALOG_ENTRY_STATUSES = ["active", "deprecated"] as const;

/** Import-time aliases only — never resolve at runtime. */
export const UNIT_IMPORT_ALIASES: Readonly<Record<string, CanonicalMeasuredBoqUnit>> = {
  sqm: "m2",
  "m²": "m2",
  lm: "m",
  each: "item",
  ea: "item",
  hour: "hr",
  hours: "hr",
};
