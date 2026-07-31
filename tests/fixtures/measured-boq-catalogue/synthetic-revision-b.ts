/**
 * SYNTHETIC TEST-ONLY catalogue revision B.
 * Same rate keys as revision A with different rates for reproduction tests.
 * Values are NOT product prices.
 */

import type { MeasuredBoqCatalogueSourceSnapshot } from "@repo/services";

export const SYNTHETIC_REVISION_B_ID = "mboq-2099.01.02" as const;

export const syntheticRevisionBEntries = [
  {
    rateKey: "synth.paint.m2",
    displayName: "SYNTHETIC paint walls B (test only)",
    description: "Test fixture B — not a product price",
    tradeOrDomain: "test",
    unit: "m2" as const,
    costType: "combined" as const,
    baseUnitRate: 15,
    currency: "GBP" as const,
    vatBasis: "exclusive" as const,
    sourceReference: "synthetic-fixture-b",
    status: "active" as const,
    replacementRateKey: null,
  },
  {
    rateKey: "synth.tile.m2",
    displayName: "SYNTHETIC tile floor B (test only)",
    description: "Test fixture B — not a product price",
    tradeOrDomain: "test",
    unit: "m2" as const,
    costType: "materials" as const,
    baseUnitRate: 30,
    currency: "GBP" as const,
    vatBasis: "exclusive" as const,
    sourceReference: "synthetic-fixture-b",
    status: "active" as const,
    replacementRateKey: null,
  },
];

export const syntheticRevisionBSnapshot: MeasuredBoqCatalogueSourceSnapshot = {
  schemaVersion: "mboq-catalogue-v1",
  catalogRevision: SYNTHETIC_REVISION_B_ID,
  currency: "GBP",
  vatBasis: "exclusive",
  regionalBasis: "uk-region-multipliers-v1",
  effectiveFrom: "2099-01-02",
  sourceDescription: "SYNTHETIC TEST FIXTURE B — not production rates",
  entryCount: syntheticRevisionBEntries.length,
  status: "draft",
  createdBy: "test-fixture",
  production: false,
  entries: syntheticRevisionBEntries,
};
