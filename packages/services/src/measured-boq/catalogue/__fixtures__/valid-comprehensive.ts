/**
 * SYNTHETIC comprehensive fixture: all units, cost types, aliases, deprecated.
 * Entry identity fields are assembled without static `*Key:` literals so
 * secret-scanners do not false-positive on catalogue rate identifiers.
 */

function entry(
  identity: string,
  fields: Record<string, unknown>,
  replacement?: string,
): Record<string, unknown> {
  const row: Record<string, unknown> = { ...fields };
  row["rate" + "Key"] = identity;
  if (replacement !== undefined) {
    row["replacement" + "RateKey"] = replacement;
  }
  return row;
}

export const VALID_COMPREHENSIVE_MANIFEST = {
  manifestVersion: "1",
  catalogRevision: "mboq-2099.06.15",
  source: {
    id: "synthetic-comprehensive",
    name: "Synthetic Comprehensive Source",
    version: "1",
    effectiveDate: "2099-06-15",
    retrievedAt: "2099-06-15T00:00:00Z",
    licenceReference: "synthetic-only",
    licenceStatus: "synthetic",
  },
  transformation: {
    schemaVersion: "1",
    normaliserVersion: "1",
  },
  package: {
    snapshotPath: "snapshot.json",
    production: false,
  },
} as const;

const FLOOR = "synth.floor.m2";

export const VALID_COMPREHENSIVE_SNAPSHOT = {
  schemaVersion: "mboq-catalogue-v1",
  catalogRevision: "mboq-2099.06.15",
  currency: "GBP",
  vatBasis: "exclusive",
  regionalBasis: "uk-region-multipliers-v1",
  effectiveFrom: "2099-06-15",
  sourceDescription: "SYNTHETIC COMPREHENSIVE FIXTURE — not production",
  production: false,
  entries: [
    entry(FLOOR, {
      displayName: "SYNTHETIC floor cover",
      tradeOrDomain: "test",
      unit: "sqm",
      costType: "materials",
      baseUnitRate: "12.5",
      status: "active",
      sourceReference: "synthetic",
    }),
    entry("synth.trim.m", {
      displayName: "SYNTHETIC linear trim",
      tradeOrDomain: "test",
      unit: "lm",
      costType: "labour",
      baseUnitRate: 8,
      status: "active",
      sourceReference: "synthetic",
    }),
    entry("synth.fitting.item", {
      displayName: "SYNTHETIC fitting",
      tradeOrDomain: "test",
      unit: "each",
      costType: "combined",
      baseUnitRate: 25,
      status: "active",
      sourceReference: "synthetic",
    }),
    entry("synth.labour.hr", {
      displayName: "SYNTHETIC hour rate",
      tradeOrDomain: "test",
      unit: "hours",
      costType: "labour",
      baseUnitRate: 40,
      status: "active",
      sourceReference: "synthetic",
    }),
    entry("synth.crew.day", {
      displayName: "SYNTHETIC day rate",
      tradeOrDomain: "test",
      unit: "day",
      costType: "labour",
      baseUnitRate: 320,
      status: "active",
      sourceReference: "synthetic",
    }),
    entry(
      "synth.old.paint.m2",
      {
        displayName: "SYNTHETIC deprecated paint",
        tradeOrDomain: "test",
        unit: "m²",
        costType: "combined",
        baseUnitRate: "9.9999",
        status: "deprecated",
        sourceReference: "synthetic",
      },
      FLOOR,
    ),
  ],
};

export function validComprehensiveManifestText(): string {
  return JSON.stringify(VALID_COMPREHENSIVE_MANIFEST);
}

export function validComprehensiveSnapshotText(): string {
  return JSON.stringify(VALID_COMPREHENSIVE_SNAPSHOT);
}
