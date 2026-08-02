/**
 * SYNTHETIC test-only minimum valid package objects (B1B).
 * Not product prices. Not for catalogue-sources/ commits (B1C).
 */

function entry(identity: string, fields: Record<string, unknown>): Record<string, unknown> {
  return { ...fields, ["rate" + "Key"]: identity };
}

export const VALID_MINIMUM_MANIFEST = {
  manifest_version: "1",
  catalog_revision: "mboq-2099.01.01",
  source: {
    id: "synthetic-test-source",
    name: "Synthetic Test Source",
    version: "1",
    effective_date: "2099-01-01",
    licence_reference: "synthetic-only",
    licence_status: "synthetic",
  },
  transformation: {
    schema_version: "1",
    normaliser_version: "1",
  },
  package: {
    snapshot_path: "snapshot.json",
    production: false,
  },
} as const;

export const VALID_MINIMUM_SNAPSHOT = {
  schemaVersion: "mboq-catalogue-v1",
  catalogRevision: "mboq-2099.01.01",
  currency: "GBP",
  vatBasis: "exclusive",
  regionalBasis: "uk-region-multipliers-v1",
  effectiveFrom: "2099-01-01",
  sourceDescription: "SYNTHETIC TEST FIXTURE — not production rates",
  production: false,
  entryCount: 1,
  entries: [
    entry("synth.paint.m2", {
      displayName: "SYNTHETIC paint walls",
      tradeOrDomain: "test",
      unit: "m2",
      costType: "combined",
      baseUnitRate: 10,
      currency: "GBP",
      vatBasis: "exclusive",
      sourceReference: "synthetic-fixture",
      status: "active",
    }),
  ],
};

export function validMinimumManifestText(): string {
  return JSON.stringify(VALID_MINIMUM_MANIFEST);
}

export function validMinimumSnapshotText(): string {
  return JSON.stringify(VALID_MINIMUM_SNAPSHOT);
}
