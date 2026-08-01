/**
 * Deterministic SHA-256 content checksum for measured-BOQ catalogue snapshots.
 * Pure — no database IO, no Node builtins.
 */

import { sha256Hex } from "./sha256";
import type { MeasuredBoqCatalogueValidatedEntry } from "./types";

export type CanonicalCatalogueChecksumInput = {
  schemaVersion: string;
  catalogRevision: string;
  currency: string;
  vatBasis: string;
  regionalBasis: string;
  effectiveFrom: string;
  entries: Array<{
    rateKey: string;
    displayName: string;
    description?: string | null;
    tradeOrDomain: string;
    unit: string;
    costType: string;
    baseUnitRate: number;
    currency: string;
    vatBasis: string;
    sourceReference?: string | null;
    status: string;
    replacementRateKey?: string | null;
  }>;
};

function canonicalEntry(
  entry: CanonicalCatalogueChecksumInput["entries"][number],
): Record<string, unknown> {
  return {
    rateKey: entry.rateKey,
    displayName: entry.displayName,
    description: entry.description ?? null,
    tradeOrDomain: entry.tradeOrDomain,
    unit: entry.unit,
    costType: entry.costType,
    baseUnitRate: entry.baseUnitRate,
    currency: entry.currency,
    vatBasis: entry.vatBasis,
    sourceReference: entry.sourceReference ?? null,
    status: entry.status,
    replacementRateKey: entry.replacementRateKey ?? null,
  };
}

/**
 * Build the canonical JSON string used for content_checksum.
 * Entries are sorted by rateKey ascending. Field order is fixed.
 */
export function canonicalCatalogueSerialisation(input: CanonicalCatalogueChecksumInput): string {
  const entries = [...input.entries]
    .sort((a, b) => (a.rateKey < b.rateKey ? -1 : a.rateKey > b.rateKey ? 1 : 0))
    .map(canonicalEntry);

  const canonical = {
    schemaVersion: input.schemaVersion,
    catalogRevision: input.catalogRevision,
    currency: input.currency,
    vatBasis: input.vatBasis,
    regionalBasis: input.regionalBasis,
    effectiveFrom: input.effectiveFrom,
    entries,
  };

  return JSON.stringify(canonical);
}

/** SHA-256 lowercase hex of the canonical serialisation. */
export function computeCatalogueContentChecksum(input: CanonicalCatalogueChecksumInput): string {
  return sha256Hex(canonicalCatalogueSerialisation(input));
}

export function computeSnapshotContentChecksum(
  snapshot: Pick<
    {
      schemaVersion: string;
      catalogRevision: string;
      currency: string;
      vatBasis: string;
      regionalBasis: string;
      effectiveFrom: string;
      entries: MeasuredBoqCatalogueValidatedEntry[] | CanonicalCatalogueChecksumInput["entries"];
    },
    | "schemaVersion"
    | "catalogRevision"
    | "currency"
    | "vatBasis"
    | "regionalBasis"
    | "effectiveFrom"
    | "entries"
  >,
): string {
  return computeCatalogueContentChecksum(snapshot);
}
