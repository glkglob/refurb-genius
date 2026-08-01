/**
 * Measured-BOQ catalogue source-contract documentation.
 *
 * Runtime validators and types live in `@repo/services` measured-boq catalogue
 * module. This file documents the contract shape only — no production prices.
 */

/**
 * Revision natural key: mboq-YYYY.MM.DD[.N]
 * Entry identity: (catalogRevision, rateKey)
 * Canonical units: m2 | m | item | hr | day
 * Cost types: labour | materials | combined
 * Currency: GBP exclusive VAT
 * Regional basis: uk-region-multipliers-v1
 * Max entries: 50_000
 * Max rate key: 160
 * Max revision: 64
 */

export const MEASURED_BOQ_SOURCE_CONTRACT_VERSION = "mboq-catalogue-v1" as const;
