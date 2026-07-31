/**
 * Shared authority-command decoder policy and resource limits.
 *
 * Constants are the staged boundary for category (4C2B) and later measured-BOQ
 * tickets. Presentation code must not redefine or silently change these values.
 */

/** Maximum decoded JSON payload size for authority commands (256 KiB). */
export const MAX_AUTHORITY_REQUEST_BYTES = 256 * 1024;

/** Maximum rooms in a measured-BOQ authority/draft command. */
export const MAX_ROOMS = 100;

/** Maximum line items per room. */
export const MAX_ITEMS_PER_ROOM = 200;

/** Maximum total line items across all rooms. */
export const MAX_TOTAL_ITEMS = 2_000;

/** Maximum length for generic identifiers (room id, item id, etc.). */
export const MAX_IDENTIFIER_LENGTH = 128;

/** Maximum length for durable idempotency keys. */
export const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

/** Maximum display name length (rooms, items). */
export const MAX_NAME_LENGTH = 200;

/** Maximum category label length. */
export const MAX_CATEGORY_LENGTH = 100;

/** Maximum unit string length. */
export const MAX_UNIT_LENGTH = 64;

/** Maximum free-text notes length. */
export const MAX_NOTES_LENGTH = 2_000;

/** Maximum library rate key length. */
export const MAX_RATE_KEY_LENGTH = 160;

/** Maximum catalogue revision string length. */
export const MAX_CATALOG_REVISION_LENGTH = 64;

/**
 * Server-owned category pricing policy version.
 * Must change only when the canonical category formula changes materially.
 * Never accepted from the caller.
 */
export const CATEGORY_PRICING_POLICY_VERSION = "category-engine-v1" as const;

export type CategoryPricingPolicyVersion = typeof CATEGORY_PRICING_POLICY_VERSION;
