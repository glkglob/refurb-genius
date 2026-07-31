/**
 * SYNTHETIC TEST-ONLY catalogue revision A.
 * Values are NOT product prices and must never be published as production rates.
 */

import type { MeasuredBoqCatalogueSourceSnapshot } from "@repo/services";

export const SYNTHETIC_REVISION_A_ID = "mboq-2099.01.01" as const;

export const syntheticRevisionAEntries = [
  {
    rateKey: "synth.paint.m2",
    displayName: "SYNTHETIC paint walls (test only)",
    description: "Test fixture — not a product price",
    tradeOrDomain: "test",
    unit: "m2" as const,
    costType: "combined" as const,
    baseUnitRate: 10,
    currency: "GBP" as const,
    vatBasis: "exclusive" as const,
    sourceReference: "synthetic-fixture-a",
    status: "active" as const,
    replacementRateKey: null,
  },
  {
    rateKey: "synth.tile.m2",
    displayName: "SYNTHETIC tile floor (test only)",
    description: "Test fixture — not a product price",
    tradeOrDomain: "test",
    unit: "m2" as const,
    costType: "materials" as const,
    baseUnitRate: 20,
    currency: "GBP" as const,
    vatBasis: "exclusive" as const,
    sourceReference: "synthetic-fixture-a",
    status: "active" as const,
    replacementRateKey: null,
  },
];

export const syntheticRevisionASnapshot: MeasuredBoqCatalogueSourceSnapshot = {
  schemaVersion: "mboq-catalogue-v1",
  catalogRevision: SYNTHETIC_REVISION_A_ID,
  currency: "GBP",
  vatBasis: "exclusive",
  regionalBasis: "uk-region-multipliers-v1",
  effectiveFrom: "2099-01-01",
  sourceDescription: "SYNTHETIC TEST FIXTURE A — not production rates",
  entryCount: syntheticRevisionAEntries.length,
  status: "draft",
  createdBy: "test-fixture",
  production: false,
  entries: syntheticRevisionAEntries,
};
